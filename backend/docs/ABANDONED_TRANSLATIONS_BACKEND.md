# Покинуті переклади — Backend

Документ описує **поточну** серверну реалізацію: (1) публічний список покинутих перекладів, (2) як книга потрапляє в статус `ABANDONED` і що з нею відбувається далі.

---

## 1) Публічний список: URL і підключення

- Кореневий префікс API: `FanVers_project/urls.py` → `path('api/', include('apps.api.urls'))`
- Каталог: `apps/api/urls.py` → `path('catalog/', include('apps.catalog.api.urls'))`
- Маршрут: `apps/catalog/api/urls.py` → `path('abandoned-translations/', abandoned_translations, name='abandoned-translations')`

**Endpoint:** `GET /api/catalog/abandoned-translations/`

---

## 2) View і логіка вибірки для списку

Файл: `apps/catalog/api/views.py`  
Функція: `abandoned_translations(request)`

1. Фільтр: `Book.objects.filter(translation_status='ABANDONED')`. У штатній моделі для **авторських** книг `translation_status` порожній, тому вони сюди не потрапляють; явного `book_type=TRANSLATION` у цьому queryset **немає** (на відміну від Celery-задач, де фільтр `book_type='TRANSLATION'` обов’язковий).
2. Оптимізація: `select_related('owner', 'creator')`, `prefetch_related('genres', 'tags', 'fandoms', 'country')`.
3. Серіалізація: `BookReaderSerializer(..., many=True, context={'request': request})`.
4. Відповідь: `200 OK` з масивом об’єктів книги.

Помилки: виняток → `500`, тіло `{ "error": "Внутрішня помилка сервера" }` (деталі в логах сервера).

---

## 3) Права доступу до списку

На `abandoned_translations` є **явний** `@permission_classes([AllowAny])`, що перевизначає глобальне правило DRF:

- `FanVers_project/settings.py` → `REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']` = **`IsAuthenticated`**.

**Наслідок:** endpoint доступний анонімним і авторизованим користувачам завдяки явному `AllowAny`.

---

## 4) Формат відповіді (payload)

Серіалізатор: `apps/catalog/api/serializers.py` → `BookReaderSerializer`.

**Повний перелік полів** (`Meta.fields`): `id`, `title`, `title_en`, `author`, `description`, `image`, `translation_status`, `translation_status_display`, `original_status`, `original_status_display`, `country`, `slug`, `last_updated`, `owner_username`, `creator_username`, `bookmark_status`, `bookmark_id`, `adult_content`, `book_type`, `chapters_count`, `genres`, `tags`, `fandoms`, `created_at`.

**Закладки:** `bookmark_status` / `bookmark_id` для неавторизованого користувача — `null` (логіка в `get_bookmark_*`).

---

## 5) Як книга стає «покинутою» (не API списку, а життєвий цикл)

Це робить **фонова задача Celery**, а не сам endpoint `abandoned-translations`.

### 5.1 Модель `Book`

Файл: `apps/catalog/models.py`

- **`translation_status = 'ABANDONED'`** — книга показується в розділі покинутих і **виключається** з ТОП/трендів (див. `apps/analytics_books/services/books_filter.py`).
- **`owner_last_activity_at`** — час останньої **свідомої** активності власника перекладу (не кожен `save()` книги).
- **`abandoned_warning_sent_at`** — коли було надіслано попередження в поточному циклі неактивності (щоб не дублювати листи).

Окремий метод **`Book.mark_translation_owner_activity(book)`** — оновлює `owner_last_activity_at` і скидає `abandoned_warning_sent_at` (новий цикл після активності власника).

### 5.2 Що вважається активністю власника перекладу

Оновлення `owner_last_activity_at` викликається з коду API (наприклад): додавання / редагування / видалення глави власником, зміна `translation_status` у дозволених серіалізаторах, плюс **перший** `save()` перекладу з власником без дати — у `Book.save()` (адмінка, shell, не лише DRF).

Не підміняє активність: довільні технічні зміни, аналітика переглядів, дії читачів тощо — якщо для них не викликано `mark_translation_owner_activity`.

### 5.3 Пороги часу

Файл: `apps/catalog/abandoned_thresholds.py`

| Константа | Значення (зміст) |
|-----------|------------------|
| `ABANDONED_TOTAL_DAYS` | 90 — повна неактивність до переносу в `ABANDONED` |
| `ABANDONED_WARNING_AFTER_DAYS` | 83 — після стільки днів без активності надсилається **перше** попередження |

У тексті першого попередження кількість «днів/хвилин до переносу» береться як **`ABANDONED_TOTAL_DAYS - ABANDONED_WARNING_AFTER_DAYS`** (наприклад 90−83=7).

**Попередження** шлеться лише у **вікні** між 83 і 90 днями неактивності: якщо вже ≥90 днів, у тому ж запуску задачі спочатку **не** шлють попередження, а виконується перенос (щоб не було двох листів одразу).

**Перемикач dev:** якщо встановити змінну оточення **`ABANDONED_THRESHOLDS_USE_MINUTES=1`** (або `true`/`yes`), ті самі **числа 90 / 83** трактуються як **хвилини** (локальні тести; у тексті лишається різниця 90−83). У продакені змінну **не вмикати** — використовуються **дні**.

### 5.4 Задачі Celery і сповіщення

Файл: `apps/notification/tasks.py`

- **`send_abandoned_notification`** — обгортка над `_send_abandoned_warnings_impl()` (можна викликати окремо з Celery).
- **`check_abandoned_books`** — послідовно викликає `_send_abandoned_warnings_impl()`, потім `_abandon_inactive_translations_impl()`: перенос у `ABANDONED`, зняття `owner`, повідомлення власнику **до** зняття, скидання `abandoned_warning_sent_at`.

Повідомлення зберігаються в `apps/notification/models.py` → `Notification`.

### 5.5 Розклад (Beat)

Файл: `FanVers_project/celery.py` → `beat_schedule` → задача `check_abandoned_books`.

- **Продакен (типово):** `crontab(hour=3, minute=0)` — **раз на добу о 03:00 UTC** (та сама хвилина, що й `cleanup-old-analytics` у `celery.py` — різні задачі, один процес beat їх обидві ставить у чергу).
- **Dev / часті запуски:** **`ABANDONED_BEAT_EVERY_MINUTE=1`** → `*/1` хвилина.

Розклад задається **`FanVers_project/celery.py`** (`app.conf.beat_schedule`); у `settings.py` **не** задано `CELERY_BEAT_SCHEDULER` (не використовується `django_celery_beat.schedulers.DatabaseScheduler`). Застосунок **`django_celery_beat`** лишено в `INSTALLED_APPS` для міграцій/адмінки; фактичний розклад beat береться з коду.

**Інфраструктура:** мають працювати процеси **Celery worker** і **Celery beat** з доступом до брокера Redis (налаштування `CELERY_*` у `settings.py`).

---

## 6) Пов’язані файли (орієнтир)

| Файл | Роль |
|------|------|
| `apps/catalog/api/views.py` | `abandoned_translations` |
| `apps/catalog/api/serializers.py` | `BookReaderSerializer` |
| `apps/catalog/models.py` | `Book`, статуси, `owner_last_activity_at`, `mark_translation_owner_activity` |
| `apps/catalog/abandoned_thresholds.py` | пороги 90 / 83 і режим хвилин |
| `apps/notification/tasks.py` | попередження та перенос у `ABANDONED` |
| `apps/notification/models.py` | `Notification` |
| `docs/NOTIFICATIONS_BACKEND.md` | REST списку повідомлень, права, `version`, сигнали |
| `FanVers_project/celery.py` | `beat_schedule`, задача `check_abandoned_books` |
| `apps/analytics_books/services/books_filter.py` | виключення `ABANDONED` з ТОП/трендів |

---

## 7) Frontend (посилання)

- `frontend/src/api/catalogApi.ts` — `getAbandonedTranslations()`
- `frontend/src/catalog/AbandonedTranslations.tsx`
- `frontend/src/docs/ABANDONED_TRANSLATIONS_FRONTEND.md`
