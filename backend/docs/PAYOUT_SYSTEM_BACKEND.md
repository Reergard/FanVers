# Система виплат (Payouts) - Backend

## Загальний огляд

Система виплат дозволяє авторам та перекладачам виводити зароблені FanCoins на банківський рахунок (IBAN) через Wise Batch Payments.

**Курс:** 1 FanCoin = 1 UAH (фіксований). Рахунок FanVers у Wise — у **CZK** (чеські крони, `WISE_SOURCE_CURRENCY`). Конвертація UAH → валюту отримувача (EUR, CZK, UAH тощо) відбувається адміном через курс Wise API або вручну перед створенням batch. У CSV для Wise використовується `amountCurrency=target` — тобто `amount_net` вказується у валюті отримувача.

**Django-додаток:** `apps.payouts` (`backend/apps/payouts/`)

---

## Архітектура

### Потік виплати (повний цикл)

```
Користувач натискає "Запросити виплату"
  → POST /api/users/withdraw-balance/
    → create_payout_request() [atomic, select_for_update]
      → Списання FanCoins з балансу
      → Створення PayoutRequest (status=awaiting_review)
      → amount_gross = coins_after_commission (UAH)
      → exchange_rate = 1.0 (початковий, для UAH — остаточний)
  → Адмін у Django Admin:
    → Перевіряє заявку → "Схвалити" → status=approved
      → Автоматично підтягує курс від Wise API (UAH → payout_currency)
      → exchange_rate оновлюється, amount_net перераховується
    → Вибирає approved запити → "Створити batch для Wise (CSV)"
      → Перевірка: чи встановлено exchange_rate для не-UAH заявок
      → Генерується CSV (sourceCurrency=CZK, amountCurrency=target)
      → PayoutBatch створюється, запити → status=in_batch
    → Завантажує CSV у Wise Business
    → Позначає batch як відправлений → status=processing
      → CSV-файл видаляється (безпека IBAN)
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
| `currency` | CharField | Валюта отримувача (`UAH`, `EUR`, `CZK` тощо) |
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
| `payout_currency` | CharField | Валюта виплати (`UAH`, `EUR`, `CZK` тощо — з `PayoutMethod.currency`) |
| `exchange_rate` | DecimalField(12,6) | Курс UAH → payout_currency. Для UAH = `1.000000` (остаточний). Для інших валют — початково `1.000000`, адмін оновлює через Wise API або вручну перед batch |
| `amount_gross` | DecimalField | Сума до податків **у UAH** (= coins_after_commission × 1.0) |
| `amount_net` | DecimalField | Сума до виплати **у валюті отримувача** (= amount_gross × exchange_rate − withholding_tax) |
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

### NewPayoutRequest (proxy)

Proxy-модель для `PayoutRequest`. Не створює окрему таблицю — використовує ту саму `payouts_payoutrequest`. Зареєстрована в admin окремо як `NewPayoutRequestAdmin` і показує лише заявки зі статусами `pending` / `awaiting_review`.

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
6. Комісія при виведенні: **0%** звичайний, **10%** терміновий (`is_urgent`)
7. `amount_gross` = coins_after_commission (у UAH). Для UAH-отримувачів `exchange_rate=1.0` (остаточний), для інших — `1.0` (початковий, адмін оновлює перед batch)
8. Створює `PayoutRequest` зі статусом `awaiting_review`, snapshot реквізитів (IBAN, KYC-дані)
9. Автоперевірка **вимкнена** — усі заявки потребують ручного схвалення адміністратором

**Захист від дублювання:** `BalanceIdempotencyRecord` з unique constraint на `(user, key)`. Якщо запит з таким же `idempotency_key` вже існує — `IntegrityError`, повертається існуючий `PayoutRequest`.

### `payout_cancel.py` — Скасування та обробка невдалих виплат

**`cancel_payout_request(payout_request, reason)`:**
- Блокує запит через `select_for_update()` (спочатку блокує, потім перевіряє статус — захист від TOCTOU)
- Дозволені статуси для скасування: `pending`, `awaiting_review`, `approved`, `in_batch`
- Якщо статус `processing` або `completed` — кидає `ValidationError`
- Якщо вже `cancelled` або `failed` — мовчки повертає (ідемпотентність)
- Повертає FanCoins на баланс через `profile.balance_operation(coins_amount, 'refund')`
- Змінює статус на `cancelled`

**`handle_failed_payout(payout_request, wise_reason)`:**
- Аналогічно, але для Wise-помилок (webhook або reconciliation)
- Змінює статус на `failed`
- Також робить refund FanCoins

### `csv_export.py` — Генерація CSV для Wise

**`generate_wise_csv(payout_requests)`** — створює CSV для Wise Batch Payments.

Захист від CSV formula injection: значення, що починаються з `=`, `+`, `-`, `@`, табуляції — екрануються префіксом `'`.

| Колонка | Опис |
|---------|------|
| `name` | Ім'я отримувача (snapshot_recipient_name) |
| `recipientEmail` | Порожнє |
| `receiverType` | Завжди `PRIVATE` |
| `amount` | Сума до виплати (`amount_net`, **у валюті отримувача**) |
| `sourceCurrency` | Валюта рахунку FanVers у Wise (`settings.WISE_SOURCE_CURRENCY` = `CZK`) |
| `targetCurrency` | Валюта отримувача (`payout_currency`: `EUR`, `CZK`, `UAH` тощо) |
| `amountCurrency` | Завжди `target` — amount вказана у валюті отримувача, Wise сам конвертує з sourceCurrency |
| `IBAN` | IBAN отримувача (snapshot) |
| `BIC` | BIC/SWIFT (snapshot, може бути порожнім) |
| `addressCountryCode` | Країна отримувача ISO 3166-1 alpha-2 (`snapshot_country`, напр. `UA`, `CZ`) |
| `addressCity` | Місто отримувача (`snapshot_city`) |
| `addressFirstLine` | Адреса отримувача (`snapshot_address_line`) |
| `addressPostCode` | Поштовий індекс (`snapshot_postal_code`) |
| `reference` | `FV-{request.id}` — ідентифікатор для reconciliation |

> **Примітка:** Wise вимагає адресні поля для певних валют/країн (наприклад, UAH → Україна). Для CZK/EUR локальних переказів Wise може їх не вимагати, але ми включаємо їх завжди для уніфікації.

### `exchange_rates.py` — Курси валют через Wise API

**`fetch_rate(source, target)`** — отримує актуальний курс від Wise API (`GET https://api.wise.com/v1/rates`).
- Кешується на 10 хвилин (Redis/Django cache)
- Потрібен `WISE_API_TOKEN` у `.env`
- Якщо `source == target` — повертає `1.000000`
- Кидає `RateFetchError` при проблемах (немає токена, 401, 403, невалідна відповідь)

**`apply_rate_to_payout(payout_request)`** — отримує курс UAH → `payout_currency` і оновлює `exchange_rate` та `amount_net` у БД.
- Формула: `amount_net = amount_gross × rate − withholding_tax_amount`
- Для UAH-отримувачів — нічого не робить (повертає існуючий `amount_net`)

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

**Зараз не використовується** — усі заявки створюються одразу зі статусом `awaiting_review`, а схвалення виконується вручну адміністратором. Задача залишається в коді для можливого ввімкнення автосхвалення у майбутньому.

Виконує перевірки: профіль схвалений, мінімальна сума, кулдаун IBAN, максимальна сума (порог 50000), наявність попередніх виплат.

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

- Список: id, username, urgent_badge, coins_amount, amount_net, commission_percent, commission_coins, payout_currency, status, created_at, deadline_at, deadline_status
- `deadline_status` — кольорове відображення:
  - Червоний "ПРОСТРОЧЕНО" якщо після дедлайну
  - Оранжевий "{N} дн" якщо <= 3 дні
  - Звичайний "{N} дн" інакше
- `exchange_rate_hint` — кольорова підказка: червоний "⚠ Курс НЕ встановлено!" якщо не-UAH і rate=1.0, або розрахунок "X UAH × rate = Y CUR"

**Редаговані поля** (не readonly): `exchange_rate`, `amount_net`, `withholding_tax_rate`, `withholding_tax_amount`. При зміні `exchange_rate` в формі `save_model` автоматично перераховує `amount_net`.

**Дії адміністратора:**

| Дія | Опис |
|-----|------|
| Схвалити вибрані запити | pending/awaiting_review → approved. Автоматично отримує курс від Wise API для не-UAH заявок |
| Оновити курс валют (Wise API) | Оновлює exchange_rate і amount_net для не-UAH заявок (awaiting_review/approved) через Wise API |
| Створити batch для Wise (CSV) | Генерує CSV з approved запитів. **Блокує** якщо є не-UAH заявки з exchange_rate=1.0 (курс не встановлено) |
| Позначити batch відправленим | in_batch → processing, batch → sent_to_wise. **Видаляє CSV-файли** з диску (містять розшифровані IBAN) |
| Позначити виплаченим | Для кожного запиту викликає `mark_payout_request_completed_manual()` |
| Скасувати вибрані запити (повернення коштів) | Скасовує запити зі статусами pending/awaiting_review/approved/**in_batch** з поверненням FanCoins на баланс |

**Видалення запитів (delete_selected):** при натисканні «Видалити запит на виплату» відображається кастомна сторінка підтвердження українською мовою з попередженням, що кошти НЕ будуть повернуті на баланс (шаблон `admin/payouts/payoutrequest/delete_selected_confirmation.html`).

**Створення batch** обгорнуто в `transaction.atomic()` з `select_for_update()` для захисту від race conditions.

### NewPayoutRequestAdmin

Proxy-адмін для `NewPayoutRequest`. Наслідує повну конфігурацію `PayoutRequestAdmin` (колонки, дії, fieldsets), але `get_queryset()` фільтрує лише `status__in=["pending", "awaiting_review"]`. У сайдбарі — перший пункт розділу «Вивід балансу».

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
WISE_SOURCE_CURRENCY = "CZK"             # Валюта рахунку FanVers у Wise
WISE_API_TOKEN = env.str("WISE_API_TOKEN", default="")  # Токен для Wise API (курси валют)
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

Комісія платформи **знімається при покупці глав** (в `subscription/services.py`), а **не при виведенні коштів**. При створенні `PayoutRequest` комісія **0%** для звичайного виведення, **10%** для термінового (`is_urgent=True`, дедлайн 3 дні замість 14).

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
WISE_API_TOKEN=                 # Токен Wise API для автоматичних курсів валют
                                # Створити: Wise Business → Settings → API tokens → Full access або Read only
WISE_WEBHOOK_ENABLED=True       # або False для тестового середовища
PAYOUT_ADMIN_EMAIL=admin@fan-vers.com
```

---

## Операційні процедури

### Обробка batch виплат (покроково)

1. Відкрити Django Admin → PayoutRequest
2. Відфільтрувати за статусом "pending" або "awaiting_review"
3. Вибрати потрібні запити → Дія **"Схвалити вибрані запити"**
   - Статус → `approved`
   - Автоматично підтягуються курси від Wise API для не-UAH заявок
   - Якщо Wise API не доступний — встановити курс вручну (відкрити заявку → поле `exchange_rate`)
4. (Опціонально) Перевірити/оновити курси: вибрати заявки → **"Оновити курс валют (Wise API)"**
5. Вибрати approved запити → Дія **"Створити batch для Wise (CSV)"**
   - Якщо для не-UAH заявок exchange_rate=1.0 — дія **заблокована** (потрібно встановити курс)
   - CSV-файл автоматично скачається, запити → `in_batch`
6. Увійти в Wise Business → Batch Payments → Upload CSV
7. Перевірити отримувачів у Wise → Підтвердити відправку
8. У Django Admin: вибрати ті ж запити → **"Позначити batch як відправлений у Wise"**
   - CSV-файли автоматично видаляються з диску (містять розшифровані IBAN)
9. Дочекатися обробки Wise (webhook або ручна перевірка)
10. Якщо webhook вимкнений: завантажити reconciliation CSV з Wise → PayoutBatch → "Імпорт CSV"
    Або: вибрати запити → **"Позначити виплаченим"** (ручне підтвердження)

### Скасування заявок

- **З поверненням коштів:** вибрати запити → "Скасувати вибрані запити (повернення коштів)". Працює для: pending, awaiting_review, approved, in_batch
- **Без повернення (видалення):** вибрати запити → "Видалити запит на виплату". Показує сторінку підтвердження з попередженням, що кошти НЕ повернуться

### Перевірка дедлайнів

Автоматично щодня о 9:00 UTC. Адміністратор отримує email якщо:
- Є запити з дедлайном менше 3 днів
- Є прострочені запити

### Схвалення профілю виплат

1. Django Admin → PayoutProfile
2. Перевірити дані (ПІБ, адреса, ІПН, IBAN)
3. Дія "Схвалити вибрані профілі" → `payout_approved=True`
