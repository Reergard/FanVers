# Оплата через Stripe Checkout (backend)

Документ описує **лише те, що реально є в коді** репозиторію: поповнення балансу (FanCoins) через **Stripe Checkout Session**, webhook, моделі та зв’язок із балансом користувача. Інші грошові операції (вивід, покупка глав тощо) **не проходять через `apps.payments`**, якщо про це окремо не сказано нижче.

---

## 1. Де в проєкті лежить код

| Що | Шлях |
|----|------|
| Додаток Django | `backend/apps/payments/` |
| Моделі | `apps/payments/models.py` |
| Бізнес-логіка Stripe + зарахування | `apps/payments/services.py` |
| HTTP API (DRF + Django view webhook) | `apps/payments/api/views.py` |
| URL маршрути додатка | `apps/payments/api/urls.py` |
| Серіалізатори запитів | `apps/payments/api/serializers.py` |
| Celery-задача «протухлі» сесії | `apps/payments/tasks.py` |
| Адмінка | `apps/payments/admin.py` |
| Підключення до головного API | `backend/apps/api/urls.py` → `path('payments/', include('apps.payments.api.urls'))` |
| Корінь API | `backend/FanVers_project/urls.py` → префікс `api/` |
| Розклад beat (разом з іншими задачами) | `backend/FanVers_project/celery.py` |
| Налаштування Stripe | `backend/FanVers_project/settings.py` (блок `STRIPE_*`) |
| Ручне поповнення балансу (не Stripe) | `backend/apps/users/api/balance_views.py` → `AddBalanceView` |
| Зміна балансу в операціях | `backend/apps/users/models.py` → `Profile.balance_operation()` |
| Запис ідемпотентності для deposit/withdraw | `backend/apps/users/models.py` → `BalanceIdempotencyRecord` |

---

## 2. Публічні URL (повний шлях)

Усі маршрути нижче мають префікс **`/api/`** (див. `FanVers_project/urls.py`).

| Метод | URL | Хто викликає |
|-------|-----|--------------|
| `GET` | `/api/payments/fee-preview/?amount=...` | Авторизований клієнт (JWT) |
| `POST` | `/api/payments/create-checkout-session/` | Авторизований клієнт (JWT) |
| `GET` | `/api/payments/session-status/?session_id=...` | Авторизований клієнт (JWT) |
| `POST` | `/api/payments/webhook/` | Сервери Stripe (без JWT) |

---

## 3. Змінні середовища та налаштування Django

Читаються в `FanVers_project/settings.py`:

| Змінна | Призначення |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Секретний ключ API Stripe для сервера. Якщо порожній рядок, `CreateCheckoutSessionView` повертає **500** з текстом `"Stripe is not configured"`. |
| `STRIPE_WEBHOOK_SECRET` | Секрет підпису webhook (`whsec_...`). Якщо порожній, `stripe_webhook` повертає **500** (без тіла в коді — `HttpResponse(status=500)`). |
| `STRIPE_API_VERSION` | Версія API Stripe для клієнта. За замовчуванням у коді: `2024-12-18.acacia`. |
| `SERVICE_FEE_PERCENT` | Відсоток сервісного збору при поповненні. За замовчуванням **5**. |
| `SERVICE_FEE_FIXED_CZK` | Фіксована частина збору в CZK. За замовчуванням **8**. |
| `SERVICE_FEE_CZK_UAH_FALLBACK` | Запасний курс CZK→UAH, якщо Wise API недоступний. За замовчуванням **1.70**. |
| `STRIPE_SUCCESS_URL` | База для `success_url` у Checkout. У `services.py` до неї додається `?session_id={CHECKOUT_SESSION_ID}` (спочатку `rstrip("/")`). За замовчуванням: у `DEBUG` — `http://127.0.0.1:5173/payment/success`, інакше — `https://fan-vers.com/payment/success`. |
| `STRIPE_CANCEL_URL` | `cancel_url` для Checkout. За замовчуванням: у `DEBUG` — `http://127.0.0.1:5173/profile`, інакше — `https://fan-vers.com/profile`. |

Також використовується **`MAX_BALANCE_OPERATION_AMOUNT`** (у `settings.py` зараз **100000**): у `create_checkout_session` сума в FanCoins не може перевищувати це значення (перевірка в `services.py`).

Ініціалізація клієнта Stripe у **`apps/payments/services.py`**:

- `stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)`
- `stripe.api_version = getattr(settings, "STRIPE_API_VERSION", None)`

Приклад змінних для розробки є в **`backend/.env.example`**.

---

## 4. Моделі даних

### 4.1. `PaymentSession` (`apps/payments/models.py`)

Зв’язує внутрішній запис оплати з сесією Stripe Checkout.

| Поле | Тип / обмеження | Зміст |
|------|-----------------|--------|
| `id` | `UUID`, PK | Внутрішній ідентифікатор сесії оплати. |
| `user` | FK → `users.User` | Хто ініціював оплату. `related_name="payment_sessions"`. |
| `stripe_session_id` | `CharField(128)`, `unique`, індекс, **`null=True`, `blank=True`** | Ідентифікатор `cs_...` від Stripe. Спочатку **`None`**: запис створюється до виклику Stripe, після успішного `Session.create` оновлюється через `update()`. |
| `stripe_payment_intent_id` | `CharField`, опційно | Payment Intent з об’єкта сесії у webhook. |
| `amount_coins` | `Decimal(10,2)` | Скільки FanCoins зарахувати; саме це значення потім передається в `balance_operation` (не сума з metadata webhook). |
| `amount_kopecks` | `PositiveInteger` | Сума для Stripe **з урахуванням сервісного збору**: `int(amount_charged_uah * 100)` (мінімальні одиниці валюти для `unit_amount`). |
| `service_fee_uah` | `Decimal(10,2)`, default 0 | Розмір сервісного збору в UAH, що був включений у `amount_kopecks`. |
| `currency` | `CharField(3)`, default `uah` | Валюта Checkout. |
| `status` | choices | `pending`, `paid`, `expired`, `failed`. За замовчуванням `pending`. |
| `metadata` | `JSONField` | Доп. дані: у коді кладуться `user_id`, `amount_coins`, за наявності — `ip`, `user_agent` (обрізаний до 500 символів). |
| `created_at` | auto | Час створення запису. |
| `paid_at` | опційно | Виставляється при переході в `paid` з webhook. |
| `expires_at` | `DateTime` | `timezone.now() + 30 хв` на момент створення запису (паралельно з `expires_at` Unix у Stripe + 1800 с). |

**Індекси та обмеження:**

- Індекс `(status, created_at)` — `idx_pay_sess_status_created`.
- `UniqueConstraint(user, stripe_session_id)` — `uniq_payment_session_user_stripe_session`. Для PostgreSQL кілька рядків з `stripe_session_id IS NULL` зазвичай не порушують унікальність по `NULL` (стандартна поведінка UNIQUE).

**Метод `mark_expired_if_due()`** — переводить один об’єкт з `pending` у `expired`, якщо час `expires_at` минув. У поточному коді фонова задача використовує **масовий `update` по `created_at`**, а не цей метод.

**Статус `failed`:** є в `choices`, але **жоден поточний шлях у `apps/payments` не виставляє `failed` автоматично** (тільки `pending` / `paid` / `expired` через наявний код).

### 4.2. `WebhookEvent` (`apps/payments/models.py`)

Зберігає оброблені події Stripe для **дедуплікації** (повторна доставка того самого `evt_...`).

| Поле | Зміст |
|------|--------|
| `stripe_event_id` | PK, `evt_...` |
| `event_type` | Рядок типу події |
| `processed_at` | `auto_now_add` |
| `payload` | Повний JSON події |

---

## 5. Потік: створення Checkout Session

Реалізація: **`create_checkout_session`** у `services.py`, викликається з **`CreateCheckoutSessionView.post`**.

### 5.1. Перевірки суми (`_validate_amount`)

- `amount_coins` обов’язковий, `> 0`.
- Не більше двох знаків після коми (порівняння з `quantize(Decimal("0.01"))`).
- **Мінімум поповнення:** `Profile.MIN_DEPOSIT_AMOUNT` (у `models.py` це **100**).
- **Максимум однієї операції:** `settings.MAX_BALANCE_OPERATION_AMOUNT` (за замовчуванням **100000**).

Серіалізатор **`CreateCheckoutSessionSerializer`** дозволяє `Decimal` від **0.01**; жорсткі межі **100 / 100000** накладаються вже в `services.py`. Тому суми між 0.01 і 99.99 на рівні HTTP можуть пройти DRF, але дадуть помилку всередині `create_checkout_session` → view поверне **400** з загальним текстом українською.

### 5.2. Ліміт балансу (`_validate_balance_limit`)

- Якщо `profile.balance + amount_coins > 1_000_000` → `ValueError("max balance exceeded")` (той самий поріг «максимум балансу», що перевіряється в міксині при deposit).

### 5.3. Розрахунок сервісного збору

Перед транзакцією викликається **`calculate_service_fee(amount_coins)`** (`services.py`):

1. Зчитуються `SERVICE_FEE_PERCENT` та `SERVICE_FEE_FIXED_CZK` із `settings.py`.
2. Курс CZK→UAH — з кешу (`service_fee:czk_uah_rate`, TTL 24 год) або через **Wise API** (`apps.payouts.services.exchange_rates.fetch_rate`). При помилці API — fallback із `SERVICE_FEE_CZK_UAH_FALLBACK`.
3. `fee_fixed_uah = fee_fixed_czk × rate` (округлення ROUND_UP до 0.01).
4. `fee_from_percent = amount_coins × percent / 100` (ROUND_UP).
5. `fee_total = fee_from_percent + fee_fixed_uah`.
6. `amount_charged = amount_coins + fee_total`.

Результат — `ServiceFeeResult` (dataclass).

### 5.4. Транзакція БД перед Stripe

У **`transaction.atomic()`**:

1. `Profile.objects.select_for_update().get(user_id=user.id)` — блокування рядка профілю.
2. Перевірка ліміту балансу.
3. `PaymentSession.objects.create(...)` з `stripe_session_id=None`, `status=pending`, `expires_at` через 30 хв, `amount_kopecks=amount_charged_kopecks` (з урахуванням збору), `service_fee_uah`, `metadata`.

### 5.5. Виклик Stripe (поза транзакцією)

`stripe.checkout.Session.create` з параметрами з коду:

- `payment_method_types=['card']`, `mode='payment'`, `currency='uah'`.
- Одна позиція `line_items` з `unit_amount=amount_charged_kopecks` (**сума + збір**).
- `client_reference_id=str(user.id)`.
- `customer_email` — `user.email`, якщо атрибут є, інакше `None`.
- `metadata` Stripe = `metadata` з БД **плюс** `payment_session_id` (UUID запису).
- `success_url` = `STRIPE_SUCCESS_URL` без завершального `/` + `?session_id={CHECKOUT_SESSION_ID}`.
- `cancel_url` = `STRIPE_CANCEL_URL`.
- `expires_at` = Unix `now + 1800`.

Після відповіді:

- Якщо немає `id` або `url` сесії → `RuntimeError`.
- Інакше: `PaymentSession.objects.filter(id=...).update(stripe_session_id=...)`.

**Важливо:** Stripe отримує `amount_charged_kopecks` (сума + збір), але в `PaymentSession.amount_coins` зберігається **оригінальна** сума без збору — саме вона зараховується на баланс через `balance_operation` у webhook.

### 5.6. Відповідь API

`CreateCheckoutSessionView` повертає **`{"checkout_url": "<url>"}`** при успіху.

**Обмеження частоти:** `ScopedRateThrottle`, `throttle_scope = "purchase"` → у `settings.py` для `'purchase'` задано **`10/hour`** (глобальна сітка `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`).

**Помилки:**

- Немає `STRIPE_SECRET_KEY` → **500**, `{"error": "Stripe is not configured"}`.
- Будь-який виняток у `create_checkout_session` логуються з `exc_info`, клієнту **400**, `{"error": "Не вдалося створити платіж. Спробуйте ще раз."}`.

---

## 5.7. Попередній перегляд збору (fee-preview)

**`FeePreviewView`** (`apps/payments/api/views.py`), `GET /api/payments/fee-preview/?amount=...`:

- Доступ: **JWT + `IsAuthenticated`**.
- Валідація: `FeePreviewQuerySerializer` — `amount` як `Decimal`, від **100** до **100000**.
- Викликає `calculate_service_fee(amount)` і повертає JSON:

```json
{
  "amount_coins": "1000.00",
  "fee_percent": "5",
  "fee_fixed_uah": "13.60",
  "fee_total_uah": "63.60",
  "amount_charged_uah": "1063.60"
}
```

Фронтенд використовує цей ендпоінт для показу розбивки збору в модалці поповнення (debounce 400 мс).

---

## 6. Потік: webhook

View: **`stripe_webhook`** у `apps/payments/api/views.py` — звичайний Django view, **`@csrf_exempt`**, **`@require_POST`**.

### 6.1. Тіло та підпис

- `payload = request.body` (байти).
- `sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")`.
- `event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)`.

**Відповіді до обробки типу події:**

- Немає `STRIPE_WEBHOOK_SECRET` → **500**.
- `ValueError` (невалідний payload) → **400**.
- `stripe.error.SignatureVerificationError` → **400**.

### 6.2. Обробка типів

- `checkout.session.completed` → **`handle_checkout_session_completed(event=event)`**.
- `checkout.session.expired` → **`handle_checkout_session_expired(event=event)`**.
- Інші типи — ігнор (лише логіка `pass`).

Якщо під час обробки виникає необроблений виняток, він **логується** (`logger.error`, `exc_info=True`), але view **все одно** повертає **200** з `{"received": true}` — щоб Stripe не зацикливав ретраї на «внутрішніх» збоях; дедуплікація зменшує ризик подвійного зарахування.

### 6.3. `handle_checkout_session_completed` (`services.py`)

1. З `event["data"]["object"]` беруться `id` (це `stripe_session_id`), `payment_status`, `payment_intent`.
2. З кореня `event` береться `id` як `stripe_event_id`; якщо порожній — **вихід без дій**.
3. Якщо немає `stripe_session_id` або `payment_status != "paid"` — вихід.
4. За `stripe_session_id` шукається `PaymentSession` з `select_related("user")`. Немає запису — warning у лог, вихід.
5. Якщо `payment_session.status` не `pending` — вихід (вже оброблено або змінено статус).

Далі **`with transaction.atomic():`**

- **Крок 1 — `WebhookEvent`:** вкладений `transaction.atomic()` + `create`. При **`IntegrityError`** (дублікат `evt_...`) — **повний виход** з функції (зовнішня транзакція не «ламається» на PostgreSQL).
- **Крок 2 — `BalanceIdempotencyRecord`:** так само вкладений atomic + `create` з `key=str(payment_session.id)`, `operation_type=OP_DEPOSIT`. При **`IntegrityError`**: оновлюється сесія до `paid` (якщо ще `pending`), виставляються `paid_at`, `stripe_payment_intent_id`, **повернення** (зарахування не повторюється).
- **Крок 3:** `Profile.objects.get(user_id=user.id)` і **`profile.balance_operation(payment_session.amount_coins, "deposit")`** — сума **з БД**, не з webhook.
- **Крок 4:** `PaymentSession` оновлюється до `paid` з `paid_at` та `stripe_payment_intent_id`.

**Наслідок для балансу:** `balance_operation()` оновлює `Profile.balance`, створює `BalanceLog`, і для `deposit` додатково створює запис **`BalanceOperationLog`** (див. `models.py`).

### 6.4. `handle_checkout_session_expired`

Усі `PaymentSession` з даним `stripe_session_id`, статусом **`pending`**, переводяться в **`expired`** масовим `update`.

---

## 7. Перевірка статусу для фронту

**`PaymentSessionStatusView.get`:**

- Query-параметр `session_id` (обов’язковий) через `SessionStatusQuerySerializer`.
- Пошук: `PaymentSession.objects.get(stripe_session_id=session_id, user=request.user)`.
- Якщо не знайдено → **404**, `{"error": "Payment session not found"}`.
- Успіх: `status`, `amount_coins` як рядок, `paid_at` як ISO-рядок або `null`.

Доступ: **JWT + `IsAuthenticated`** (як і створення сесії).

---

## 8. Фонові задачі

**`expire_stale_payment_sessions`** (`tasks.py`):

- Усі записи з `status=pending` і `created_at` старші за **35 хвилин** → `status=expired` (`update`).

**Розклад** у `FanVers_project/celery.py`:

- Ключ `'expire-stale-payments'`, задача `apps.payments.tasks.expire_stale_payment_sessions`, `crontab(minute='*/30')`.

---

## 9. Адмінка Django

Зареєстровано в **`apps/payments/admin.py`**:

- `PaymentSession`: список, фільтри, пошук; частина полів лише для читання.
- `WebhookEvent`: список, фільтри; `payload` лише для читання.

---

## 10. Пряме поповнення балансу без Stripe (важливо для безпеки)

**`AddBalanceView`** (`apps/users/api/balance_views.py`):

- **`permission_classes = [IsAdminUser]`** — звичайний користувач отримує **403** на `POST /api/users/add-balance/` та на alias **`POST /api/users/update-balance/`** (той самий клас).

Тобто **масове зарахування FanCoins через публічний API для не-адмінів вимкнено**; сценарій «купівля coins» для користувача має йти через Stripe Checkout + webhook.

**`WithdrawBalanceView`** у цьому документі не розписується — він **не змінювався** під Stripe; логіка виводу лишається в `balance_views.py` та пов’язаних модулях.

---

## 11. Що цей модуль **не** робить

- Не приймає дані карток на сервері FanVers (оплата на стороні Stripe Checkout).
- Не застосовує **Publishable key** (`pk_...`) на backend (він для клієнта Stripe.js; у цьому проєкті Checkout — redirect, див. фронтенд-док).
- Не оформлює покупку глав або підписки — там інші ендпоінти та сервіси (`purchase_chapter`, subscription тощо), оплата часто йде **з внутрішнього балансу** після поповнення.

---

## 12. Міграції

- **`0001_initial.py`** — створює `WebhookEvent` та `PaymentSession`.
- **`0003_add_service_fee_uah.py`** — додає поле `service_fee_uah` до `PaymentSession` (`default=0`).

Після змін моделей потрібно стандартно **`makemigrations` / `migrate`**.
