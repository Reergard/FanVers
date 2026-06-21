# Панель адміністратора FanVers

Документація для внутрішнього користування. Описує Django Admin на базі **django-unfold** (v0.94.0).

## Доступ

| Середовище | URL | Примітка |
|------------|-----|----------|
| Локально | `http://127.0.0.1:8000/admin/` | Порт **Django/Daphne (8000)**, не Vite (5173) |
| Прод | `https://fan-vers.com/<DJANGO_ADMIN_PATH>/` | Шлях з `.env`: `DJANGO_ADMIN_PATH` (за замовчуванням `admin`) |

Потрібні `is_staff=True` (або суперкористувач). Ролі на сайті (Читач / Перекладач / Літератор) керуються в **Профілі**, не в User.

## Технічний стек

- **django-unfold** — тема поверх стандартного `django.contrib.admin`
- Admin-класи проєкту: `unfold.admin.ModelAdmin`, інлайни — `unfold.admin.TabularInline`
- User / Group: множинне наслідування `(BaseUserAdmin, ModelAdmin)` + форми з `unfold.forms`
- Сторонні пакети (стилі): `apps/main/admin_third_party.py`, підключення в `FanVers_project/urls.py`
- Навігація: словник `UNFOLD` у `FanVers_project/settings.py`
- Статика: `python manage.py collectstatic` (обовʼязково на проді; локально — також при Daphne)

### Залежності в `INSTALLED_APPS` (порядок важливий)

```text
unfold
unfold.contrib.filters
unfold.contrib.forms
unfold.contrib.inlines
django.contrib.admin
…
```

## Бічне меню (SIDEBAR)

Секції зверху вниз — від щоденних до рідкісних. Рідкі секції можна згорнути вручну (`collapsible`).

| Секція | Коли заходити |
|--------|----------------|
| **Контент** | Книги, глави, томи, довідники (жанри, теги, фандоми, країни), рейтинги, **реклама** |
| **Користувачі** | Облікові записи, **профілі та ролі**, групи прав |
| **Поповнення балансу** | Платежі Stripe, події Stripe (webhooks) |
| **Вивід балансу** | Усі / схвалені / відправлені / завершені / відхилені заявки; пакети batch для Wise (CSV) |
| **Підтримка** | Тікети підтримки (вкладення — з картки тікета) |
| **Моніторинг** | Журнали транзакцій, балансу, **прогрес читання** (`UserChapterProgress`: скрол, час, `is_read`), рекламні логи (переважно read-only). Деталі збору прогресу: **READING_PROGRESS_BACKEND.md** |
| **Підписки** | Налаштування підписок на книгу, активні підписки, операції (решта — через пошук у шапці) |
| **Повідомлення** | Чати та повідомлення (модерація рідко) |
| **Система** | Celery: періодичні завдання (cron/інтервали — через пошук, якщо потрібно) |

`show_all_applications` вимкнено: зайві моделі шукати через **пошук у сайдбарі** (назва українською після `verbose_name`).

### Що не в сайдбарі, але є в адмінці

- Плани підписок, використання, доступ до глав, аудит — пошук: «підписк», «план», «аудит»
- Вкладення тікетів — з тікета або пошук
- Crontab / інтервальні розклади Celery — пошук: «cron», «інтервал»
- API-токени, social auth — пошук або розділи сторонніх застосунків
- Token blacklist (JWT) — лишається стандартним Django admin (свідомо не чіпали)

## Важливі розділи по задачах

### Користувачі та ролі

1. **Користувачі** — логін, email, staff/superuser, пароль.
2. **Профілі** — роль (Читач / Перекладач / Літератор), баланс, масові дії з ролями.
3. **Групи** — права Django (не плутати з ролями профілю).

### Каталог

- **Книги** — fieldsets залежать від `book_type` (авторська / переклад).
- **Заявки на переклад** — proxy-модель `BookTranslatorReview`. Кожна книга з PENDING-заявками — один рядок; заявки відображаються як inline-таблиця. Кнопки «Схвалити» / «Відмовити» в кожному рядку через custom admin URL (`approve-application/<id>/`, `reject-application/<id>/`). Схвалення передає книгу, відхиляє інші заявки, відправляє нотифікації. Детальніше: `ABANDONED_TRANSLATIONS_BACKEND.md`, секція 7.
- **Глави** — контент, ціни, порядок; складна логіка збереження в `BookAdmin` / `ChapterAdmin`.
- Довідники: жанри, теги, групи тегів, фандоми, країни.

### Поповнення балансу (Stripe)

- **Платіжні сесії** — поповнення coins через Stripe.
- **Stripe-події** — сирі webhook Stripe (діагностика поповнень; **не** стосується виводу).

### Вивід балансу (Wise)

- **Усі заявки на виплату** — повний список; масові дії (схвалити, batch CSV, скасувати тощо).
- **Схвалені** — `approved` і `in_batch` (після batch CSV, до відправки в Wise).
- **Відправлені** — `processing` (після «Позначити batch як відправлений у Wise»).
- **Завершені** — `completed` (імпорт reconciliation CSV від Wise **або** дія «Позначити виплаченим» у заявках).
- **Відхилені** — `failed`, `cancelled`.
- **Пакети batch для Wise (CSV)** — зібрані групи; «Імпорт CSV» → Wise повертає статус COMPLETED → заявка в «Завершені».

### Реклама (у розділі Контент)

- Кампанії реклами книг на сайті.

### Моніторинг

Більшість моделей **read-only** (`has_add/delete/change = False`). Транзакції — додатковий CSS `admin/css/custom_admin.css`.

### Підписки

- **Налаштування підписок** — inline з планами на сторінці книги.
- Решта моделей підписок — через пошук у шапці адмінки.

### Підтримка

- **Тікети** — статус, пріоритет, inline вкладень і історії статусів.

## Файли, які змінювали при переході на unfold

| Файл | Призначення |
|------|-------------|
| `requirements.txt` | `django-unfold==0.94.0` |
| `FanVers_project/settings.py` | `INSTALLED_APPS`, `UNFOLD` |
| `FanVers_project/urls.py` | static у DEBUG, `register_third_party_unfold_admins()` |
| `apps/*/admin.py` | `ModelAdmin` / `TabularInline` |
| `apps/users/admin.py` | User, Profile, Group + unfold-форми |
| `apps/main/admin_third_party.py` | celery-beat, authtoken, social_django |
| `apps/*/models.py`, `apps/*/apps.py` | `verbose_name` для українських назв |

## Деплой і статика

На продакшені (`DEBUG=False`):

```bash
python manage.py collectstatic --noinput
```

Nginx (або аналог) віддає `/static/` з `STATIC_ROOT` (`backend/staticfiles`).

Локально з **Daphne**: без `collectstatic` стилі unfold можуть не завантажитись — виконати collectstatic або використовувати `staticfiles_urlpatterns` у DEBUG (вже в `urls.py`).

## Відомі обмеження

- **Дашборд** з графіками (unfold Components) не налаштований — окремий етап.
- **Token blacklist** — без unfold-стилів; на роботу JWT не впливає.
- **Фірменні кольори** (`UNFOLD["COLORS"]`) — не задані; можна додати під бренд FanVers.
- Unfold не замінює API та фронтенд — лише `/admin/`.

## Корисні команди

```bash
# Перевірка конфігурації
python manage.py check

# Список зареєстрованих моделей у admin
python manage.py shell
>>> from django.contrib import admin
>>> for m, c in sorted(admin.site._registry.items(), key=lambda x: (x[0]._meta.app_label, x[0].__name__)):
...     print(f"{m._meta.app_label:20} {m.__name__:30} {c.__class__.__name__}")
```

## Оновлення unfold

1. Зафіксувати нову версію в `requirements.txt`.
2. `pip install -r requirements.txt`
3. `collectstatic`
4. Перевірити admin вручну (особливо User, payouts CSV, subscription inline).
