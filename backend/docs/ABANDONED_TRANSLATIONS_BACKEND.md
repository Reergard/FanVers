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

- **`translation_status`** — можливі значення: `TRANSLATING`, `WAITING`, `COMPLETED`, `PAUSED`, `ABANDONED`. Статус `COMPLETED` (Завершено) доданий для позначення книг із завершеним перекладом; він **заблокований при створенні** книги (див. `INVALID_NEW_BOOK_TRANSLATION_STATUSES` у фронтенді та `invalid_statuses` у `BookCreateSerializer`), але доступний при редагуванні.
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
| `ABANDONED_TOTAL_DAYS` | 30 — повна неактивність до переносу в `ABANDONED` |
| `ABANDONED_WARNING_AFTER_DAYS` | 25 — після стільки днів без активності надсилається **перше** попередження |

У тексті першого попередження кількість «днів/хвилин до переносу» береться як **`ABANDONED_TOTAL_DAYS - ABANDONED_WARNING_AFTER_DAYS`** (наприклад 30−25=5).

**Попередження** шлеться лише у **вікні** між 25 і 30 днями неактивності: якщо вже ≥30 днів, у тому ж запуску задачі спочатку **не** шлють попередження, а виконується перенос (щоб не було двох листів одразу).

**Перемикач dev:** якщо встановити змінну оточення **`ABANDONED_THRESHOLDS_USE_MINUTES=1`** (або `true`/`yes`), ті самі **числа 30 / 25** трактуються як **хвилини** (локальні тести; у тексті лишається різниця 30−25). У продакені змінну **не вмикати** — використовуються **дні**.

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
| `apps/catalog/api/views.py` | `abandoned_translations`, `apply_become_translator` |
| `apps/catalog/api/serializers.py` | `BookReaderSerializer` |
| `apps/catalog/models.py` | `Book`, `TranslatorApplication`, `BookTranslatorReview` (proxy), статуси, `owner_last_activity_at` |
| `apps/catalog/admin.py` | `BookTranslatorReviewAdmin` + `TranslatorApplicationInline` (approve/reject) |
| `apps/catalog/abandoned_thresholds.py` | пороги 30 / 25 і режим хвилин |
| `apps/notification/tasks.py` | попередження та перенос у `ABANDONED` |
| `apps/notification/models.py` | `Notification` |
| `docs/NOTIFICATIONS_BACKEND.md` | REST списку повідомлень, права, `version`, сигнали |
| `FanVers_project/celery.py` | `beat_schedule`, задача `check_abandoned_books` |
| `FanVers_project/settings.py` | сайдбар навігація (`catalog_booktranslatorreview_changelist`) |
| `apps/analytics_books/services/books_filter.py` | виключення `ABANDONED` з ТОП/трендів |

---

## 7) Заявка на переклад покинутої книги

### Endpoint

`POST /api/catalog/books/<slug>/apply-translator/` — авторизований користувач подає заявку на переклад покинутої книги.

### View

Файл: `apps/catalog/api/views.py`, функція `apply_become_translator`.

1. Перевірка: `book.translation_status == 'ABANDONED'` (інакше 400).
2. Перевірка дублікатів: `TranslatorApplication.objects.filter(book=book, user=user, status='PENDING')` (інакше 409).
3. Створення `TranslatorApplication(status='PENDING')`.
4. Створення `Notification` для користувача.
5. Відповідь: 201.

### Модель `TranslatorApplication`

Файл: `apps/catalog/models.py`.

| Поле | Зміст |
|------|--------|
| `book` | FK → Book |
| `user` | FK → User |
| `status` | `PENDING` / `APPROVED` / `REJECTED` |
| `created_at` | auto_now_add |
| `reviewed_at` | nullable, заповнюється при approve/reject |

Унікальність: одна PENDING-заявка на пару user+book.

### Адмінка (Proxy-модель + Inline)

Файли: `apps/catalog/admin.py`, `apps/catalog/models.py` (proxy-модель `BookTranslatorReview`).

Архітектура: **одна книга = один рядок у списку**, усі PENDING-заявки на цю книгу відображаються як **inline-таблиця** на сторінці зміни.

#### Proxy-модель `BookTranslatorReview`

`apps/catalog/models.py` — `class BookTranslatorReview(Book)` з `proxy = True`. Не створює окремої таблиці в БД; дає окрему реєстрацію в адмінці з власним `verbose_name` («Заявка на переклад»).

#### `BookTranslatorReviewAdmin`

- **Список**: `get_queryset` фільтрує лише книги з хоча б однією PENDING-заявкою (`.filter(translator_applications__status='PENDING').distinct()`). Колонки: назва, кількість заявок, статус перекладу, поточний власник.
- **Форма**: readonly-поля книги (title, author, translation_status, owner). Кнопки Save приховані (`show_save = False` і т.д.).
- **Inline**: `TranslatorApplicationInline(TabularInline)` — показує лише PENDING-заявки з полями: user, status, created_at, статистика користувача, кнопки дій.
- **Кнопки Approve / Reject**: readonly-поле `get_actions` рендерить HTML-посилання (`format_html`) на custom admin URL для кожної заявки.
- **Custom URL**: `get_urls()` реєструє `approve-application/<int:app_id>/` і `reject-application/<int:app_id>/`, обгорнуті в `admin_site.admin_view()` (перевірка `is_staff`).
- **Доступ**: `has_add_permission = False`, `has_delete_permission = False`.

#### Бізнес-логіка Approve

1. Перевірка: заявка PENDING, книга ABANDONED.
2. Книга: `owner = user`, `translation_status = 'TRANSLATING'`, grace period 5 днів (`owner_last_activity_at` = now − total_inactivity_delta + 5 days), скидання `abandoned_warning_sent_at`.
3. Заявка → APPROVED, `reviewed_at = now`.
4. Інші PENDING-заявки на ту саму книгу → REJECTED (bulk `update`).
5. Нотифікація схваленому: «Вам передано переклад ... у вас є 5 днів для публікації нових розділів».
6. Нотифікації відхиленим: «Приносимо вибачення, але «{title}» не може бути передана вам, оскільки адміністрація сайту передала переклад іншому користувачу.»

#### Бізнес-логіка Reject

1. Перевірка: заявка PENDING.
2. Заявка → REJECTED, `reviewed_at = now`.
3. Нотифікація: «На жаль, вашу заявку на переклад «{title}» відхилено. Книга наразі залишається у покинутих перекладах.»

#### Навігація

Сайдбар: `FanVers_project/settings.py` → `reverse_lazy("admin:catalog_booktranslatorreview_changelist")`.

---

## 8) Frontend (посилання)

- `frontend/src/api/catalogApi.ts` — `getAbandonedTranslations()`, `applyBecomeTranslator()`
- `frontend/src/catalog/AbandonedTranslations.tsx`
- `frontend/src/catalog/ModalBecomeTranslator.tsx` — модалка підтвердження заявки
- `frontend/src/catalog/sections/BookHero.tsx` — кнопка «Стати новим перекладачем»
- `frontend/src/docs/ABANDONED_TRANSLATIONS_FRONTEND.md`
