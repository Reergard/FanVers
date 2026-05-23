# Система виплат (Payouts) - Backend

## Загальний огляд

Система виплат дозволяє авторам та перекладачам виводити зароблені FanCoins на банківський рахунок (IBAN) через Wise Batch Payments. Курс фіксований: **1 FanCoin = 1 UAH**. Wise автоматично конвертує UAH у валюту отримувача при відправці.

**Django-додаток:** `apps.payouts` (`backend/apps/payouts/`)

---

## Архітектура

### Потік виплати (повний цикл)

```
Користувач натискає "Запросити виплату"
  → POST /api/users/withdraw-balance/
    → create_payout_request() [atomic, select_for_update]
      → Списання FanCoins з балансу
      → Створення PayoutRequest (status=pending)
      → Запуск async задачі auto_check_payout_request
        → Перевірка профілю, суми, кулдауну IBAN
        → Якщо все ок і сума < порогу → status=approved
        → Інакше → status=awaiting_review (ручна перевірка)
  → Адмін у Django Admin:
    → Вибирає approved запити → "Створити batch для Wise (CSV)"
      → Генерується CSV-файл, PayoutBatch створюється
      → Запити переходять у status=in_batch
    → Завантажує CSV у Wise Business
    → Позначає batch як відправлений → status=processing
  → Wise обробляє платежі:
    → Webhook або CSV reconciliation → status=completed або failed
    → При failed → refund FanCoins на баланс
```

---

## Моделі (`models.py`)

### PayoutProfile

Профіль для KYC/верифікації отримувача виплат. Один профіль на користувача (`OneToOneField` до `User`).

| Поле | Тип | Опис |
|------|-----|------|
| `country` | CharField(2) | Країна (ISO 3166-1 alpha-2) |
| `full_name_legal` | CharField | ПІБ рідною мовою |
| `full_name_latin` | CharField | ПІБ латиницею (для Wise) |
| `address_line` | CharField | Адреса |
| `city` | CharField | Місто |
| `postal_code` | CharField | Поштовий індекс |
| `verification_status` | CharField | Статус верифікації: `draft`, `pending`, `approved`, `rejected`, `requires_more_info`, `cancelled` |
| `payout_approved` | BooleanField | Чи може запитувати виплати |

**Властивість:** `can_request_payout` повертає `True` якщо: `payout_approved=True`, `verification_status=approved`, роль дозволяє виведення, є хоча б один активний метод виплати.

### PayoutMethod

Платіжний метод (IBAN) для виплати. Прив'язаний до `PayoutProfile`.

| Поле | Тип | Опис |
|------|-----|------|
| `iban` | EncryptedCharField | IBAN, зашифрований Fernet |
| `bic_swift` | EncryptedCharField | BIC/SWIFT, зашифрований (необов'язковий) |
| `recipient_full_name` | CharField | Ім'я отримувача в банку |
| `currency` | CharField | Валюта, завжди `UAH` |
| `is_active` | BooleanField | Чи активний метод |
| `is_default` | BooleanField | Чи метод за замовчуванням |
| `last_used_at` | DateTimeField | Остання виплата |
| `successful_payouts_count` | IntegerField | Кількість успішних виплат |

**Властивість:** `is_iban_cooldown_active` — повертає `True` якщо IBAN було змінено менше ніж `PAYOUT_IBAN_COOLDOWN_DAYS` (7) днів тому.

### PayoutRequest

Запит на виплату. Основна сутність системи.

| Поле | Тип | Опис |
|------|-----|------|
| `profile` | ForeignKey(PayoutProfile) | Профіль отримувача |
| `method` | ForeignKey(PayoutMethod) | Метод виплати |
| `batch` | ForeignKey(PayoutBatch) | Batch для Wise (nullable) |
| `coins_amount` | DecimalField | Кількість FanCoins до комісії |
| `commission_percent` | DecimalField | Відсоток комісії на момент запиту |
| `commission_coins` | DecimalField | Комісія в FanCoins |
| `coins_after_commission` | DecimalField | FanCoins після комісії |
| `payout_currency` | CharField | Завжди `UAH` |
| `exchange_rate` | DecimalField | Завжди `1.000000` |
| `amount_gross` | DecimalField | Сума до податків (= coins_after_commission) |
| `amount_net` | DecimalField | Сума до виплати |
| `snapshot_recipient_name` | CharField | Знімок імені отримувача |
| `snapshot_iban` | EncryptedCharField | Знімок IBAN (зашифрований у БД, розшифровується автоматично при читанні через ORM — див. «Подвійне шифрування при snapshot-ах») |
| `snapshot_bic_swift` | EncryptedCharField | Знімок BIC/SWIFT (зашифрований у БД) |
| `idempotency_key` | UUIDField | Ключ ідемпотентності (unique) |
| `status` | CharField | Статус запиту (див. нижче) |
| `wise_transfer_id` | CharField | ID переказу у Wise |
| `invoice_number` | CharField | Номер інвойсу |
| `deadline_at` | DateTimeField | Дедлайн обробки |
| `auto_check_result` | JSONField | Результат автоперевірки |
| `failure_reason` | TextField | Причина відхилення/скасування |

**Статуси PayoutRequest:**

```
pending          → Щойно створений, чекає автоперевірки
awaiting_review  → Потребує ручної перевірки адміністратором
approved         → Схвалений, готовий для batch
in_batch         → Включений у batch CSV
processing       → Відправлений у Wise
completed        → Виплату здійснено
failed           → Виплата не вдалась (кошти повернуто)
cancelled        → Скасовано (кошти повернуто)
```

### PayoutBatch

Batch для групової відправки через Wise.

| Поле | Тип | Опис |
|------|-----|------|
| `name` | CharField | Назва batch (авто: дата) |
| `status` | CharField | `draft`, `csv_generated`, `sent_to_wise`, `partial`, `completed`, `cancelled` |
| `csv_file` | FileField | Збережений CSV-файл |
| `total_count` | IntegerField | Кількість запитів у batch |
| `total_amount_by_currency` | JSONField | Суми за валютами |
| `created_by` | ForeignKey(User) | Хто створив batch |

---

## Шифрування IBAN (`fields.py`)

IBAN та BIC/SWIFT зберігаються в базі у зашифрованому вигляді.

**Алгоритм:**
1. Береться `PAYOUT_ENCRYPTION_KEY` з Django settings (fallback: `SECRET_KEY`)
2. Обчислюється `SHA-256` хеш → 32 байти
3. Кодується в `base64` → ключ для Fernet
4. Fernet шифрує/розшифровує значення при запису/читанні

```python
source = getattr(settings, "PAYOUT_ENCRYPTION_KEY", None) or settings.SECRET_KEY
key = base64.urlsafe_b64encode(hashlib.sha256(source.encode()).digest())
fernet = Fernet(key)
```

**Важливо:** Якщо `PAYOUT_ENCRYPTION_KEY` не задано, використовується `SECRET_KEY`. Зміна ключа зробить усі раніше збережені IBAN нечитабельними. Рекомендується задавати окремий `PAYOUT_ENCRYPTION_KEY` у `.env`.

### Подвійне шифрування при snapshot-ах

`EncryptedCharField` працює прозоро через Django ORM:
- **Запис у БД** (`get_prep_value`): plaintext → зашифрований текст
- **Читання з БД** (`from_db_value`): зашифрований текст → plaintext

Це важливо при створенні snapshot-ів IBAN у `PayoutRequest`:

```python
# payout_create.py
snapshot_iban=method.iban,       # method.iban — вже розшифрований (from_db_value)
snapshot_bic_swift=method.bic_swift or "",
```

Поле `PayoutMethod.iban` (EncryptedCharField) при читанні автоматично розшифровується.
Поле `PayoutRequest.snapshot_iban` (теж EncryptedCharField) при записі автоматично шифрується.
Тобто дані проходять цикл: **зашифровано в БД → розшифровано в Python → знову зашифровано в БД**.

Фінальний стан: обидва поля зберігають **окремі** зашифровані значення в БД, навіть якщо plaintext однаковий. Кожен виклик `Fernet.encrypt()` генерує унікальний ciphertext (Fernet використовує випадковий IV).

**Де це проявляється:**

| Контекст | Що бачимо | Чому |
|----------|-----------|------|
| Python-код (`req.snapshot_iban`) | Розшифрований IBAN | `from_db_value` декодує автоматично |
| Django Admin (readonly поле) | Розшифрований IBAN | Той самий ORM-механізм |
| CSV-експорт (`generate_wise_csv`) | Розшифрований IBAN | `req.snapshot_iban` повертає plaintext |
| Прямий SQL-запит до БД | Зашифрований blob | Fernet-ciphertext, нечитабельний |
| Django `.filter(snapshot_iban=...)` | **Не працює** | Кожне шифрування дає різний ciphertext |

**Практичні наслідки:**
- Пошук за IBAN через ORM `.filter()` неможливий — для пошуку потрібен або окремий hash-поле, або перебір із розшифровкою.
- При дебагу в Django shell: `req.snapshot_iban` завжди повертає plaintext — це нормальна поведінка, не витік даних.
- CSV-файли, що генеруються адмін-екшеном `create_wise_batch`, містять **розшифровані IBAN** — тому екшен `mark_batch_sent` видаляє CSV-файли з диску після завантаження у Wise.
- Якщо `from_db_value` не може розшифрувати значення (наприклад, після ротації ключа), він повертає оригінальний зашифрований рядок без помилки (silent fallback в `except Exception`).

---

## Сервіси

### `payout_create.py` — Створення запиту на виплату

**Функція:** `create_payout_request(user, coins_amount, method, idempotency_key)`

**Що робить (atomic транзакція):**
1. Створює `BalanceIdempotencyRecord` для захисту від дублювання (якщо `IntegrityError` — повертає існуючий `PayoutRequest`)
2. Перевіряє `PayoutProfile.can_request_payout`
3. Перевіряє мінімальну суму (`PAYOUTS_MIN_AMOUNT_COINS` = 1000)
4. Перевіряє кулдаун IBAN (`PAYOUT_IBAN_COOLDOWN_DAYS` = 7 днів)
5. Списує FanCoins з балансу через `profile.balance_operation(coins_amount, "withdraw")` (усередині: `select_for_update`, перевірка балансу, `BalanceLog`)
6. Комісія при виведенні: **0%** (комісія платформи знімається при покупці глав, не при виплаті)
7. Створює `PayoutRequest` з фіксованим курсом 1:1, snapshot реквізитів (IBAN, KYC-дані)
8. Запускає `auto_check_payout_request.delay(request.id)`

**Захист від дублювання:** `BalanceIdempotencyRecord` з unique constraint на `(user, key)`. Якщо запит з таким же `idempotency_key` вже існує — `IntegrityError`, повертається існуючий `PayoutRequest`.

### `payout_cancel.py` — Скасування та обробка невдалих виплат

**`cancel_payout_request(payout_request, reason)`:**
- Блокує запит через `select_for_update()` (спочатку блокує, потім перевіряє статус — захист від TOCTOU)
- Якщо статус `processing` або `completed` — кидає `ValidationError`
- Якщо вже `cancelled` або `failed` — мовчки повертає (ідемпотентність)
- Повертає FanCoins на баланс через `profile.balance_operation(amount, 'refund')`
- Змінює статус на `cancelled`

**`handle_failed_payout(payout_request, wise_reason)`:**
- Аналогічно, але для Wise-помилок (webhook або reconciliation)
- Змінює статус на `failed`
- Також робить refund FanCoins

### `csv_export.py` — Генерація CSV для Wise

**`generate_wise_csv(payout_requests)`** — створює CSV з колонками:

| Колонка | Опис |
|---------|------|
| recipientName | Ім'я отримувача (snapshot) |
| recipientEmail | Порожнє |
| IBAN | IBAN (snapshot) |
| BIC | BIC/SWIFT (snapshot) |
| targetCurrency | Завжди `UAH` |
| targetAmount | Сума до виплати (amount_net) |
| sourceCurrency | Завжди `UAH` |
| reference | `FV-{request.id}` — ідентифікатор для reconciliation |

### `csv_import.py` — Reconciliation з Wise

**`import_wise_reconciliation_csv(csv_content)`:**

Обробляє CSV з Wise після завершення batch:
- Для кожного рядка парсить `Reference` (формат `FV-{id}`)
- Якщо `Status=COMPLETED` → позначає запит як `completed`, оновлює `method.successful_payouts_count`
- Якщо `Status=REFUNDED/CANCELLED/FAILED` → викликає `handle_failed_payout()` (refund)
- Кожен рядок обробляється у власній `transaction.atomic` з `select_for_update()`

### `webhook.py` — Wise Webhook

**`verify_wise_signature(request)`:**
1. Читає заголовок `X-Signature-SHA256WithRSA`
2. Завантажує публічний ключ Wise з `https://api.wise.com/v3/public-keys` (кешується 24 години)
3. Верифікує RSA-SHA256 підпис тіла запиту

**`process_wise_webhook(data)`:**
- Обробляє `transfers#state-change` події
- Парсить `reference` (формат `FV-{id}`)
- `outgoing_payment_sent` → `status=completed`
- `funds_refunded` / `cancelled` → `handle_failed_payout()` (refund)
- Обгорнуто в `@transaction.atomic` з `select_for_update()`

---

## Async задачі (`tasks.py`)

### `auto_check_payout_request(payout_request_id)`

Запускається автоматично після створення запиту. Виконує перевірки:

1. **Профіль схвалений** — `profile.payout_approved == True`
2. **Мінімальна сума** — `coins_amount >= PAYOUTS_MIN_AMOUNT_COINS`
3. **Кулдаун IBAN** — метод не на кулдауні
4. **Максимальна сума** — `coins_amount <= PAYOUTS_AUTO_APPROVE_THRESHOLD_COINS` (50000)
5. **Попередні виплати** — чи має користувач завершені виплати раніше

**Результати:**
- Усі перевірки пройдені + нижче порогу + є попередні виплати → `status=approved` (авто-схвалення)
- Інакше → `status=awaiting_review` (ручна перевірка)
- Критична помилка (профіль не схвалений) → `status=cancelled` + refund

### `check_payout_deadlines()`

Щоденна задача (9:00 UTC, Celery Beat). Перевіряє запити в активних статусах:

- **Прострочені** (deadline_at < now) → лог `ERROR` + email адміністратору
- **Наближаються** (залишилось <= 3 дні) → лог `WARNING` + email адміністратору

Email відправляється на `PAYOUT_ADMIN_EMAIL` з налаштувань.

---

## API ендпоінти (`api/views.py`, `api/urls.py`)

Базовий шлях: `/api/payouts/`

| Метод | URL | View | Опис |
|-------|-----|------|------|
| GET | `/profile/` | PayoutProfileView | Отримати профіль виплат |
| POST | `/profile/` | PayoutProfileView | Створити профіль |
| PUT | `/profile/` | PayoutProfileView | Оновити профіль |
| POST | `/profile/submit/` | PayoutProfileSubmitView | Подати на перевірку |
| GET | `/methods/` | PayoutMethodView | Список методів виплати |
| POST | `/methods/` | PayoutMethodView | Додати метод (IBAN) |
| POST | `/request/` | CreatePayoutRequestView | Створити запит на виплату |
| GET | `/requests/` | PayoutRequestListView | Мої запити (останні 50) |
| POST | `/request/<id>/cancel/` | CancelPayoutRequestView | Скасувати запит |
| POST | `/wise-webhook/` | wise_webhook_view | Webhook від Wise |

**Throttling:** `CreatePayoutRequestView` обмежений 5 запитами на годину (scope `payout`).

**Webhook:** `@csrf_exempt`, перевіряє підпис Wise, повертає 200 OK навіть при помилках (щоб Wise не повторював).

---

## Серіалізатори (`api/serializers.py`)

### PayoutMethodSerializer

- `iban` та `bic_swift` — `write_only` (приймаються тільки при створенні)
- `iban_masked` — `read_only`, показує тільки перші 4 та останні 4 символи IBAN
- `is_iban_cooldown_active` — `read_only`, boolean

### CreatePayoutRequestSerializer

| Поле | Тип | Опис |
|------|-----|------|
| `amount` | DecimalField | Сума FanCoins |
| `method_id` | IntegerField | ID методу виплати |
| `idempotency_key` | CharField | UUID для захисту від дублювання |

---

## Адмін-панель (`admin.py`)

### PayoutProfileAdmin

- Список: user, legal_status, country, verification_status, payout_approved
- Фільтри: verification_status, payout_approved, legal_status, country
- Інлайн: PayoutMethodInline
- Дії: **"Схвалити профілі"**, **"Відхилити профілі"**

### PayoutRequestAdmin

- Список: id, username, coins_amount, amount_net, status, created_at, deadline_at, deadline_status
- `deadline_status` — кольорове відображення:
  - Червоний "ПРОСТРОЧЕНО" якщо після дедлайну
  - Оранжевий "{N} дн" якщо <= 3 дні
  - Звичайний "{N} дн" інакше

**Дії адміністратора:**

| Дія | Опис |
|-----|------|
| Схвалити запити | Переводить pending/awaiting_review → approved |
| Скасувати запити | Скасовує з поверненням FanCoins |
| Створити batch для Wise | Генерує CSV з approved запитів, створює PayoutBatch, завантажує CSV |
| Позначити batch відправленим | in_batch → processing, batch → sent_to_wise |

**Створення batch** обгорнуто в `transaction.atomic()` з `select_for_update()` для захисту від race conditions.

### PayoutBatchAdmin

- Колонка `reconciliation_link` — посилання "Імпорт CSV" для batch у статусі `sent_to_wise` або `partial`
- Кастомний URL: `<batch_id>/import-reconciliation/` — форма завантаження CSV з Wise
- Шаблон: `admin/payouts/import_reconciliation.html`

---

## Зміни в існуючих файлах

### `users/models.py`

- **BalanceLog:** додано `operation_type='refund'` для повернення коштів
- **Profile:** додано властивість `has_active_payout_profile` — перевіряє `payout_profile.can_request_payout`

### `users/api/balance_views.py`

- **WithdrawBalanceView:** повністю переписано — замість прямого списання балансу тепер викликає `create_payout_request()` з `apps.payouts.services.payout_create`

### `users/models.py` — `Profile.balance_operation()`

- Єдиний метод зміни балансу (замінив `update_balance()` та `BalanceOperationMixin.perform_balance_operation()`)
- Підтримує `'refund'` як кредитову операцію (зарахування на баланс)
- Для `'refund'` створює запис `BalanceOperationLog` (мониторинг)

### `users/api/serializers.py`

- **ProfileSerializer:** додано поле `has_active_payout_profile` (SerializerMethodField)

### `users/api/views.py`

- **AuthStatusView:** додано `has_active_payout_profile` у відповідь

### `monitoring/models.py`

- **BalanceOperationLog:** додано `('refund', 'Повернення')` до choices `operation_type`

### `FanVers_project/settings.py`

Нові налаштування:

```python
PAYOUTS_MIN_AMOUNT_COINS = 1000          # Мінімальна сума виведення
PAYOUTS_AUTO_APPROVE_THRESHOLD_COINS = 50000  # Авто-схвалення до цієї суми
PAYOUT_DEADLINE_DAYS = 14                # Дедлайн обробки (днів)
PAYOUT_IBAN_COOLDOWN_DAYS = 7            # Кулдаун після зміни IBAN
WISE_WEBHOOK_ENABLED = env('WISE_WEBHOOK_ENABLED')  # Увімкнути webhook
PAYOUT_ADMIN_EMAIL = env('PAYOUT_ADMIN_EMAIL')       # Email адміна для сповіщень
```

Throttle rate: `'payout': '5/hour'`

### `FanVers_project/celery.py`

Додано beat-задачу:
```python
'check-payout-deadlines': {
    'task': 'apps.payouts.tasks.check_payout_deadlines',
    'schedule': crontab(hour=9, minute=0),
}
```

### `apps/api/urls.py`

Додано: `path('payouts/', include('apps.payouts.api.urls'))`

---

## Безпека

### Race Conditions

Усі критичні операції з грошима використовують `@transaction.atomic` + `select_for_update()`:

- `create_payout_request()` — блокує профіль перед списанням балансу
- `cancel_payout_request()` — блокує запит перед перевіркою статусу (TOCTOU захист)
- `handle_failed_payout()` — блокує запит перед refund
- `process_wise_webhook()` — блокує запит перед зміною статусу
- `_reconcile_completed()` / `_reconcile_failed()` — блокує кожен запит окремо
- `create_wise_batch` (admin) — блокує approved запити в транзакції

### Ідемпотентність

- `BalanceIdempotencyRecord(user, key)` з unique constraint — захист від подвійного списання
- Idempotency key генерується на фронтенді при натисканні кнопки (не всередині mutation callback)

### Шифрування

- IBAN і BIC/SWIFT зашифровані Fernet в базі даних
- При створенні PayoutRequest робиться snapshot розшифрованих реквізитів

### Webhook

- RSA-SHA256 верифікація підпису
- Публічний ключ Wise кешується 24 години
- Повертає 200 OK навіть при помилках (запобігає повторним спробам Wise)

---

## Комісія

Комісія платформи **знімається при покупці глав** (в `subscription/services.py`), а **не при виведенні коштів**. При створенні `PayoutRequest` комісія завжди **0%**.

Поле `Profile.commission` визначає відсоток, що утримується при покупці глав, і залежить від `total_characters` (загальна кількість символів у опублікованих розділах):

| Символів | Комісія |
|----------|---------|
| < 5,000,000 | 15% |
| 5,000,000 – 10,000,000 | 12% |
| > 10,000,000 | 10% |

Оновлення: `Profile.update_commission()` (викликається при публікації/видаленні розділів). Розрахунок суми: `Profile.calculate_commission_amount(price)`.

---

## Налаштування .env

```
WISE_WEBHOOK_ENABLED=True       # або False для тестового середовища
PAYOUT_ADMIN_EMAIL=admin@fan-vers.com
```

---

## Операційні процедури

### Обробка batch виплат (покроково)

1. Відкрити Django Admin → PayoutRequest
2. Відфільтрувати за статусом "approved"
3. Вибрати потрібні запити → Дія "Створити batch для Wise (CSV)"
4. Завантажити CSV-файл, що автоматично скачається
5. Увійти в Wise Business → Batch Payments → Upload CSV
6. Перевірити отримувачів у Wise → Підтвердити відправку
7. У Django Admin: вибрати ті ж запити → "Позначити batch як відправлений у Wise"
8. Дочекатися обробки Wise (webhook або ручна перевірка)
9. Якщо webhook вимкнений: завантажити reconciliation CSV з Wise → PayoutBatch → "Імпорт CSV"

### Перевірка дедлайнів

Автоматично щодня о 9:00 UTC. Адміністратор отримує email якщо:
- Є запити з дедлайном менше 3 днів
- Є прострочені запити

### Схвалення профілю виплат

1. Django Admin → PayoutProfile
2. Перевірити дані (ПІБ, адреса, ІПН, IBAN)
3. Дія "Схвалити вибрані профілі" → `payout_approved=True`
