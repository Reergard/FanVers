# Поповнення та виведення балансу (Frontend)

## Роль інтерфейсу

UI **не** є захистом: усі обмеження перевіряються на backend. Фронт лише приховує або показує елементи за прапорцями з API та зменшує зайві помилки для користувача.

## Ендпоінти та сервіс

| Призначення | Константа (`api/endpoints.ts`) | Функція (`users/profileService.ts`) | Тіло запиту |
|-------------|-------------------------------|-------------------------------------|-------------|
| Поповнення | `API.addBalance` → `/api/users/add-balance/` | `depositBalance(amount)` | `{ amount }` |
| Виведення | `API.withdrawBalance` → `/api/users/withdraw-balance/` | `withdrawBalance(amount)` | `{ amount }` |

Запити йдуть через `api/http.ts` (Bearer, CSRF, 401 → refresh + retry).

Окремо існує alias **`POST /api/users/update-balance/`** (та сама логіка, що add-balance); у фронтових `endpoints.ts` окремого ключа немає — використовується лише якщо додасте виклик вручну.

## Сторінка профілю

Файл: `users/Profile.tsx`.

- **Поповнити** — кнопка відкриває `Modal` (`shared/Modal/Modal`), поле суми, виклик `depositMutation` → `depositBalance`.
- **Вивести кошти** — рендериться **тільки** якщо `profile.can_withdraw_balance === true` (дані з `GET /api/users/profile/`). Модалка: `open={withdrawModalOpen && mayWithdrawBalance}`.
- **Історія транзакцій** — окрема модалка; список з локального `balanceHistory` після успіху мутацій (якщо API не поверне `balance_history`, список може лишатися порожнім; повний масив `balance_history` приходить у відповіді профілю власнику).

Стилі форм і кнопок усередині модалок — з `Profile.module.css` (`btnGreen`, `btnRed`, `modalForm`, тощо); оболонка модалки — спільний компонент `Modal`.

## Дані профілю та кеш

`useQuery` з ключем `["profile"]`, `queryFn: getMyProfile` (`GET /api/users/profile/`).

- Увімкнено **`refetchOnWindowFocus`** та **`refetchOnReconnect`**, щоб після змін ролі/балансу в адмінці оновити `can_withdraw_balance` та інші поля при поверненні на вкладку.
- Після **deposit/withdraw** — `invalidateQueries({ queryKey: ["profile"] })` і `refreshAuthStatus()` (синхронізація з `auth-status`).
- Після **becomeTranslator / becomeAuthor** — те саме + `refreshAuthStatus()` для `can_withdraw_balance` у store.

## Глобальний стан (шапка тощо)

Див. узагальнено `USER_DATA_FLOW.md`. Для балансу й прав додатково:

| Поле в store (`auth/store.ts`) | Джерело (auth-status) |
|--------------------------------|------------------------|
| `balance` | `balance` |
| `canWithdrawBalance` | `can_withdraw_balance` |
| `roleSelfPromotionAllowed` | `role_self_promotion_allowed` |

Оновлення: `bootstrap`, `login`/`register`, `OAuthCallback`, `refreshAuthStatus` (`auth/service.ts`).

Хук `useAuth()` повертає ці поля для компонентів, яким не потрібен повний профіль.

## Типи

Файл `users/types.ts`:

- `UserProfile`: `balance`, `can_withdraw_balance` (для чужого профілю з API може бути `null`), `role_self_promotion_allowed`, `balance_history`.
- `BalanceHistoryItem`: узгоджено з `BalanceLogSerializer` — `amount`, `operation_type`, `created_at`, `status` (поле `type` застаріле).

## Важливо для змін

1. Не прив’язувати показ кнопки виводу лише до `useAuth().canWithdrawBalance` на профілі: основне джерело для блоку балансу — **`profile.can_withdraw_balance`** після `getMyProfile`. **`useAuth()`** наповнюється з `auth-status` і може **застаріти** (наприклад, після зміни ролі в адмінці), доки не виконається bootstrap, `refreshAuthStatus` чи refocus; **`getMyProfile`** при відкритті/оновленні сторінки профілю дає свіжіший прапорець для цього UI.
2. Будь-яка нова сторінка з операціями балансу має після успіху викликати **`refreshAuthStatus`** і/або інвалідувати `["profile"]`, якщо відображається баланс у шапці або профілі.
3. Помилки **403** (роль) і валідації сум обробляти з `err.response.data` (текст `error`, за потреби `code`).
