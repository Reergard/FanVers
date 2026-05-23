# Система виплат (Payouts) - Frontend

## Загальний огляд

Фронтенд системи виплат забезпечує:
1. Налаштування профілю виплат (KYC-дані, IBAN)
2. Запит на виведення FanCoins
3. Перегляд історії запитів та їх статусів
4. Додавання нових методів виплати (IBAN)
5. Скасування запитів у статусі "pending" / "awaiting_review"

---

## Файли

| Файл | Опис |
|------|------|
| `users/PayoutSetupModal.tsx` | Модалка налаштування профілю виплат |
| `users/PayoutRequestsList.tsx` | Модалка зі списком запитів на виплату |
| `users/AddPayoutMethodModal.tsx` | Модалка додавання нового IBAN |
| `users/payoutService.ts` | API-функції для роботи з виплатами |
| `users/profileService.ts` | `withdrawBalance()` — запит на виплату |
| `users/types.ts` | TypeScript типи (PayoutProfile, PayoutMethod, PayoutRequestItem) |
| `api/endpoints.ts` | URL ендпоінтів API |
| `auth/store.ts` | `hasActivePayoutProfile` у стані авторизації |
| `auth/authStatusPatch.ts` | Маппінг `has_active_payout_profile` зі статусу авторизації |
| `users/Profile.tsx` | Головна сторінка профілю з секцією виплат |

---

## Потік користувача

### 1. Налаштування профілю виплат (перший раз)

```
Користувач не має профілю виплат
  → Бачить кнопку "Налаштувати профіль виплат"
  → Відкривається PayoutSetupModal
    → Заповнює: юр. статус, країна, ІПН, ПІБ, адреса
    → Заповнює IBAN, BIC/SWIFT, ім'я отримувача
    → Натискає "Подати на перевірку"
      → createPayoutProfile() → createPayoutMethod() → submitPayoutProfile()
  → Адмін перевіряє та схвалює профіль
  → hasActivePayoutProfile стає true
  → Тепер доступна кнопка "Запросити виплату"
```

### 2. Запит на виплату

```
Користувач натискає "Запросити виплату"
  → Відкривається модалка з:
    - Вибір методу виплати (IBAN) зі списку
    - Посилання "+ Додати новий IBAN" (відкриває AddPayoutMethodModal)
    - Поле суми (FanCoins)
    - Кнопка "Запросити виплату"
  → Генерується idempotency_key (crypto.randomUUID())
  → withdrawBalance(amount, method_id, idempotency_key)
    → POST /api/users/withdraw-balance/
  → Успіх: оновлення балансу, закриття модалки
```

### 3. Перегляд запитів

```
Користувач натискає кнопку історії виплат
  → Відкривається PayoutRequestsList
  → getPayoutRequests() → GET /api/payouts/requests/
  → Показує список з: сума, комісія, статус, дата
  → Для pending/awaiting_review: кнопка "Скасувати"
    → cancelPayoutRequest(id) → POST /api/payouts/request/{id}/cancel/
    → Кошти повертаються на баланс
```

---

## Компоненти

### PayoutSetupModal

**Файл:** `users/PayoutSetupModal.tsx`

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProfile?: PayoutProfile | null;
}
```

**Поля форми:**

| Поле | State | Опис |
|------|-------|------|
| Юридичний статус | `legalStatus` | Select: individual, fop_ua, self_employed_other, legal_entity |
| Країна (ISO) | `country` | Input, max 2 символи, за замовчуванням "UA" |
| Податкове резидентство | `taxResidency` | Input, max 2 символи |
| Податковий ID | `taxId` | Input |
| ПІБ (рідною мовою) | `fullNameLegal` | Input, обов'язковий |
| ПІБ латиницею | `fullNameLatin` | Input, обов'язковий |
| Адреса | `addressLine` | Input, обов'язковий |
| Місто | `city` | Input |
| Поштовий індекс | `postalCode` | Input |
| IBAN | `iban` | Input, тільки при створенні |
| BIC/SWIFT | `bic` | Input, необов'язковий, тільки при створенні |
| Ім'я отримувача | `recipientName` | Input, тільки при створенні |

**Логіка:**
- Якщо `existingProfile` передано → режим редагування (IBAN-поля приховані)
- При створенні → `createPayoutProfile()` + `createPayoutMethod()` + `submitPayoutProfile()`
- При редагуванні → `updatePayoutProfile()` + `submitPayoutProfile()`
- Валюта завжди `"UAH"` (захардкоджено)
- IBAN перетворюється у верхній регістр, пробіли видаляються

### PayoutRequestsList

**Файл:** `users/PayoutRequestsList.tsx`

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  userId: number | null;
}
```

**Статуси та кольори:**

| Статус | Текст | Колір |
|--------|-------|-------|
| pending | Очікує перевірки | #f0ad4e (жовтий) |
| awaiting_review | На перевірці | #f0ad4e |
| approved | Схвалено | #5cb85c (зелений) |
| in_batch | У batch | #5bc0de (блакитний) |
| processing | Обробка у Wise | #5bc0de |
| completed | Виплачено | #5cb85c |
| failed | Відхилено | #d9534f (червоний) |
| cancelled | Скасовано | #999 (сірий) |

**Кнопка "Скасувати"** відображається тільки для статусів `pending` і `awaiting_review`.

При скасуванні:
- Викликає `cancelPayoutRequest(id)`
- Інвалідує query `payoutRequests`
- Оновлює auth status (`refreshAuthStatus()`)
- Показує повідомлення "Запит на виплату скасовано, кошти повернуто"

### AddPayoutMethodModal

**Файл:** `users/AddPayoutMethodModal.tsx`

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  userId: number | null;
}
```

**Поля:**
- IBAN — обов'язковий, автоформатування (uppercase, видалення пробілів)
- BIC/SWIFT — необов'язковий
- Ім'я отримувача — обов'язковий

При збереженні:
- `createPayoutMethod({ iban, bic_swift, recipient_full_name, currency: "UAH" })`
- Інвалідує query `payoutMethods`

---

## API-сервіс (`payoutService.ts`)

| Функція | HTTP | URL | Опис |
|---------|------|-----|------|
| `getPayoutProfile()` | GET | `/api/payouts/profile/` | Профіль виплат (або `{exists: false}` якщо 404) |
| `createPayoutProfile(data)` | POST | `/api/payouts/profile/` | Створити профіль |
| `updatePayoutProfile(data)` | PUT | `/api/payouts/profile/` | Оновити профіль |
| `submitPayoutProfile()` | POST | `/api/payouts/profile/submit/` | Подати на перевірку |
| `getPayoutMethods()` | GET | `/api/payouts/methods/` | Список методів |
| `createPayoutMethod(data)` | POST | `/api/payouts/methods/` | Додати метод |
| `getPayoutRequests()` | GET | `/api/payouts/requests/` | Список запитів |
| `cancelPayoutRequest(id)` | POST | `/api/payouts/request/{id}/cancel/` | Скасувати запит |

**withdrawBalance** знаходиться в `profileService.ts`:

```typescript
withdrawBalance(amount: number, method_id: number, idempotency_key: string)
  → POST /api/users/withdraw-balance/
  → Returns: PayoutRequestResponse { ...PayoutRequestItem, new_balance }
```

---

## Типи (`types.ts`)

### PayoutProfile

```typescript
type PayoutProfile = {
  id: number;
  legal_status: string;
  country: string;
  tax_residency_country: string;
  tax_id: string;
  full_name_legal: string;
  full_name_latin: string;
  address_line: string;
  city: string;
  postal_code: string;
  verification_status: string;
  payout_approved: boolean;
  can_request_payout: boolean;
};
```

### PayoutMethod

```typescript
type PayoutMethod = {
  id: number;
  method_type: string;
  iban_masked: string;        // "UA21****5678"
  recipient_full_name: string;
  currency: string;           // "UAH"
  is_active: boolean;
  is_default: boolean;
  is_iban_cooldown_active: boolean;
};
```

### PayoutRequestItem

```typescript
type PayoutRequestItem = {
  id: number;
  coins_amount: number;
  commission_percent: number;
  commission_coins: number;
  coins_after_commission: number;
  payout_currency: string;
  exchange_rate: string;
  amount_gross: string;
  amount_net: string;
  status: string;
  created_at: string;
  invoice_number: string | null;
};
```

### PayoutRequestResponse

```typescript
type PayoutRequestResponse = PayoutRequestItem & {
  new_balance: number;
};
```

---

## Інтеграція з Profile.tsx

### State змінні

```typescript
const [payoutSetupOpen, setPayoutSetupOpen] = useState(false);
const [payoutRequestsOpen, setPayoutRequestsOpen] = useState(false);
const [addMethodOpen, setAddMethodOpen] = useState(false);
const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
const [amount, setAmount] = useState("");
```

### Query для методів виплати

```typescript
const payoutMethodsQuery = useQuery({
  queryKey: ["payoutMethods", userId],
  queryFn: getPayoutMethods,
  enabled: withdrawModalOpen && profile?.has_active_payout_profile === true,
});
```

Завантажується тільки коли відкрита модалка виведення **і** профіль виплат активний.

### Mutation для виведення

```typescript
const withdrawMutation = useMutation({
  mutationFn: ({ amt, idempotencyKey }: { amt: number; idempotencyKey: string }) =>
    withdrawBalance(amt, selectedMethodId!, idempotencyKey),
  onSuccess: async () => {
    // Інвалідація профілю, оновлення auth status
    // Закриття модалки, очищення форми
    showSuccess("Запит на виплату створено");
  },
});
```

**Idempotency key** генерується при натисканні кнопки "Запросити виплату" (`crypto.randomUUID()`), а не всередині `mutationFn`. Це гарантує що при retry React Query не створить новий ключ і не обійде захист від дублювання.

### UI логіка в секції балансу

```
Якщо НЕ hasActivePayoutProfile:
  → Показати кнопку "Налаштувати профіль виплат"

Якщо hasActivePayoutProfile і роль Перекладач/Літератор:
  → Показати кнопку "Запросити виплату"
    (disabled якщо баланс < 1000 FanCoins)
  → Показати кнопку "Мої запити на виплату"
```

### Мінімальна сума

```typescript
const MIN_PAYOUT_COINS = 1000;
```

Кнопка "Запросити виплату" недоступна якщо баланс менше 1000 FanCoins.

---

## Інтеграція з Auth Store

### store.ts

```typescript
interface AuthUser {
  // ... інші поля
  hasActivePayoutProfile: boolean | null;
}
```

Ініціалізується як `null` (невідомо). Оновлюється при:
- Завантаженні auth status
- Після успішного виведення (refreshAuthStatus)
- Після скасування запиту (refreshAuthStatus)

### authStatusPatch.ts

Маппінг з бекенд-відповіді:
```typescript
if (typeof data.has_active_payout_profile === 'boolean') {
  store.hasActivePayoutProfile = data.has_active_payout_profile;
}
```

---

## Ендпоінти (`api/endpoints.ts`)

```typescript
payoutProfile: "/api/payouts/profile/",
payoutProfileSubmit: "/api/payouts/profile/submit/",
payoutMethods: "/api/payouts/methods/",
createPayoutRequest: "/api/payouts/request/",
payoutRequests: "/api/payouts/requests/",
cancelPayoutRequest: (id: number) => `/api/payouts/request/${id}/cancel/`,
```

---

## CSS

Компоненти використовують стилі з `Profile.module.css`:

| Клас | Де використовується |
|------|---------------------|
| `styles.transactionHistory` | Контейнер списку запитів |
| `styles.modalForm` | Форма у PayoutSetupModal, AddPayoutMethodModal |
| `styles.modalHint` | Підказки у формах |
| `styles.field` | Label обгортка поля |
| `styles.fieldLabel` | Текст лейбла |
| `styles.fieldBox` | Обгортка input |
| `styles.input` | Стиль input/select |
| `styles.btnGreen` | Кнопка підтвердження |
| `styles.btnRed` | Кнопка скасування/виведення |
| `styles.balanceBtnWithdraw` | Стиль кнопки виведення в секції балансу |
| `styles.btnBalanceIcon` | Іконка на кнопці балансу |
| `styles.btnBalanceText` | Текст на кнопці балансу |

---

## Обробка помилок

Усі mutations використовують однаковий патерн:

```typescript
onError: (err: any) => {
  showError(err?.response?.data?.error ?? "Загальне повідомлення помилки");
}
```

Бекенд повертає помилки у форматі `{ error: "текст помилки" }`.

Типові помилки:
- "Профіль виплат не схвалений" — профіль ще не пройшов верифікацію
- "Недостатньо коштів" — баланс менше запитаної суми
- "IBAN на кулдауні" — метод змінений менше 7 днів тому
- "Мінімальна сума виведення: 1000 FanCoins" — замала сума
