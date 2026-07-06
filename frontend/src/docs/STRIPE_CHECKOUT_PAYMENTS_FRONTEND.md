# Оплата через Stripe Checkout (frontend)

Опис лише **фактичної** поведінки коду: поповнення балансу через **редирект на Stripe Checkout** (без `@stripe/stripe-js` / Elements). Юридичні сторінки, де згадується Stripe, тут не розбираються — лише технічний шлях у React.

---

## 1. Файли та маршрути

| Що | Шлях |
|----|------|
| API-функції платежів | `frontend/src/payments/paymentApi.ts` |
| Сторінка після успішної оплати (polling статусу) | `frontend/src/payments/PaymentSuccess.tsx` |
| Константи URL бекенду | `frontend/src/api/endpoints.ts` |
| Підключення маршруту | `frontend/src/App.tsx` |
| Модалка «купівлі coins» у профілі | `frontend/src/users/Profile.tsx` |
| HTTP-клієнт (JWT, CSRF тощо) | `frontend/src/api/http.ts` |
| Оновлення балансу в store після оплати | `frontend/src/auth/service.ts` → `refreshAuthStatus()` |

**Маршрут у додатку:**

- **`/payment/success`** — ліниве завантаження `PaymentSuccess`, обгорнуто в **`RequireAuth`** (як у `App.tsx`).

Бекенд за замовчуванням редиректить після оплати на URL з `STRIPE_SUCCESS_URL` + query `session_id={CHECKOUT_SESSION_ID}`; на dev це узгоджено з **`http://127.0.0.1:5173/payment/success`** у `settings.py`, якщо не перевизначено в `.env`.

---

## 2. Ендпоінти бекенду, які викликає фронт

У `frontend/src/api/endpoints.ts`:

| Ключ | Шлях |
|------|------|
| `feePreview` | `GET /api/payments/fee-preview/` (query `amount`) |
| `createCheckoutSession` | `POST /api/payments/create-checkout-session/` |
| `paymentSessionStatus` | `GET /api/payments/session-status/` (query `session_id`) |

Тіло створення сесії: **`{ amount }`** — число/decimal як JSON; бекенд очікує суму в **FanCoins** (грн 1:1 у бізнес-логіці бекенду).

---

## 3. `paymentApi.ts`

- **`getFeePreview(amount)`** — `http.get(API.feePreview, { params: { amount } })`, повертає **`FeePreview`**: `amount_coins`, `fee_percent`, `fee_fixed_uah`, `fee_total_uah`, `amount_charged_uah` (усі рядки). Використовується для показу розбивки збору перед оплатою.
- **`createCheckoutSession(amount)`** — `http.post(API.createCheckoutSession, { amount })`, повертає **`{ checkout_url: string }`**.
- **`getPaymentSessionStatus(sessionId)`** — `http.get(API.paymentSessionStatus, { params: { session_id: sessionId } })`, очікує відповідь з полями **`status`**, **`amount_coins`** (рядок), **`paid_at`** (`string | null`).

Помилки мережі/HTTP обробляються викликачами (див. нижче).

---

## 4. Профіль: модалка поповнення (`Profile.tsx`)

**Імпорт:** `createCheckoutSession`, `getFeePreview` з `../payments/paymentApi`.

### 4.1. Двокрокова модалка

Модалка поповнення має два кроки (стан `depositStep`):

1. **Крок «select»** — вибір платіжної системи. Поки єдиний варіант — **Stripe** (кнопка зі стилем `.payoutMethodBtn`, логотип Stripe кольором `#635bff`). При натисканні `depositStep` переходить у `"form"`.
2. **Крок «form»** — форма введення суми з розбивкою сервісного збору та кнопкою «Перейти до оплати».

При відкритті модалки завжди починається з кроку «select». При закритті — стан скидається.

### 4.2. Попередній перегляд збору

При зміні суми (`depositAmount`) з затримкою **400 мс** (debounce через `setTimeout` + `useRef`) викликається `getFeePreview(amount)`. Результат зберігається в стані `feePreview`.

Якщо `feePreview` доступний і сума ≥ 100, під полем вводу показується **блок розбивки** (`.feeBreakdown`):

- Поповнення: `amount_coins` UAH
- Сервісний збір (`fee_percent`% + `fee_fixed_uah` UAH): `fee_total_uah` UAH
- **До сплати:** `amount_charged_uah` UAH

### 4.3. Мутація `depositMutation`

- `mutationFn`: викликає `createCheckoutSession(amt)`.
- `onSuccess`: **`window.location.href = data.checkout_url`** — повне перенаправлення на хост Stripe, сесія браузера на FanVers лишається, але сторінка змінюється.
- `onError`: показує `err?.response?.data?.error` або текст **«Помилка створення платежу»**.

**Валідація суми на клієнті (перед викликом):** перевіряється лише `Number(amount)` — скінченне число та `> 0`; детальні правила **min 100 / max 100000 / ліміт балансу** перевіряються на сервері.

Після повернення зі Stripe користувач потрапляє на **`/payment/success`**, а не на модалку профілю.

---

## 5. Сторінка `PaymentSuccess.tsx`

**Query-параметр:** **`session_id`** (з `URLSearchParams`).

**Поведінка:**

1. Якщо **`session_id` відсутній** — статус вважається невдалим (`failed`), текст: **«Немає session_id у посиланні.»**
2. Інакше одразу викликається **`getPaymentSessionStatus(sessionId)`**, далі **кожні 2 секунди** повтор, доки не спрацює одна з умов зупинки.
3. При **`status === "paid"`**:
   - повідомлення про успіх;
   - **`await refreshAuthStatus()`** — оновлення даних авторизації (зокрема баланс у шапці, якщо бекенд їх віддає в `auth-status`);
   - polling зупиняється.
4. При **`expired` або `failed`** — текст про незавершену оплату / протухлу сесію, polling зупиняється.
5. Якщо з моменту старту минуло **> 60 секунд** і статус досі не `paid` — показується текст **«Оплата обробляється. Баланс буде оновлено найближчим часом.»**, polling зупиняється.
6. При помилці запиту статусу — повідомлення про невдачу перевірки, зупинка.

**Кнопки:**

- **«Повернутися до профілю»** → `navigate('/profile')`.
- **«Спробувати ще раз»** показується лише при `expired` або `failed`; зараз також веде на **`/profile`** (повторний вибір суми — у модалці профілю).

Стилізація сторінки — **інлайн-стилі** в компоненті, без окремого CSS-модуля.

---

## 6. Зв’язок із `profileService.ts`

Функція **`depositBalance`** у `frontend/src/users/profileService.ts` **ще експортується**, але **`Profile.tsx` її не імпортує і не викликає** — поповнення для користувача йде через **`createCheckoutSession`**. За пошуком по `frontend/src`, окрім самого `profileService.ts`, **`depositBalance` у виконуваному TS/TSX-коді більше ніде не використовується** (лише згадки в деяких `.md` у `src/docs`, наприклад `BALANCE_DEPOSIT_WITHDRAW_FRONTEND.md` — там описаний старий шлях через `POST /api/users/add-balance/`).

---

## 7. Безпека та секрети на клієнті

У фронтенд-коді **немає** `sk_`, `whsec_`, `rk_` — лише публічні URL шляхів до вашого API. Секрети Stripe налаштовуються **тільки на бекенді** (див. `backend/docs/STRIPE_CHECKOUT_PAYMENTS_BACKEND.md`).

---

## 8. Що фронт **не** робить

- Не вбудовує форму карти (немає Stripe Elements).
- Не зараховує баланс локально — зарахування після оплати робить **webhook на сервері**; сторінка успіху лише **чекає** статус `paid` і оновлює auth state.

---

## 9. Швидкий чеклист для розробника

1. Переконатися, що в `.env` бекенду задані `STRIPE_*` і webhook URL доступний Stripe.
2. `STRIPE_SUCCESS_URL` має вказувати на **`/payment/success`** фронту, з якого користувач залогінений (cookies / JWT як у вашому `http`).
3. Після оплати якщо статус довго `pending` — дивитися логи webhook на бекенді та події в Stripe Dashboard.
