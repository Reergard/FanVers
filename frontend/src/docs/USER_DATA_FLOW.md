# Данные пользователя на Frontend

## Схема

```
Backend (AuthStatusView)  →  authStatus()  →  useAuth()  →  компоненты (Header)
       ↑                          ↑               ↑
  GET /api/users/auth-status/   service.ts    token + subscribe
  Bearer access                 http.get()
```

## Файлы и роли

| Файл | Назначение |
|------|------------|
| `api/endpoints.ts` | `API.authStatus` → `/api/users/auth-status/` |
| `api/http.ts` | Axios-клиент: подставляет `Authorization: Bearer {access}`, при 401 — refresh и retry |
| `auth/token.ts` | Access-токен в памяти, `subscribeAccessToken()` — реактивная подписка на изменения |
| `auth/service.ts` | `authStatus()` — `http.get(API.authStatus)` → возвращает `{ isAuthenticated, userId, username, balance }` |
| `auth/useAuth.ts` | Хук: следит за токеном через `subscribeAccessToken`; при `token !== null` вызывает `authStatus()` и кэширует `userId`, `username`, `balance`; при `token === null` не запрашивает и сбрасывает; возвращает `{ isAuthenticated, userId, username, balance }` |

## Важно

- **`useAuth.isAuthenticated`** определяется наличием access в памяти, а не серверной проверкой. После F5 access пустой → временно `false` (гость), пока bootstrap/refresh восстановит access.
- **`authStatus()`** идёт через `http.ts`, поэтому при 401 может автоматически пройти refresh и один retry.

## Backend

- **Эндпоинт:** `GET /api/users/auth-status/`
- **Авторизация:** JWT в `Authorization: Bearer`
- **Ответ:** `{ isAuthenticated: true, userId: number, username: string, balance: string }`

## Использование

```ts
const { isAuthenticated, userId, username, balance } = useAuth();
// userId — id пользователя при авторизации (для Owner vs Reader в каталоге), иначе null
// username — ник (user.username) при авторизации, иначе null
// balance — баланс (profile.balance) при авторизации, иначе null
```

## Баланс

Тот же путь, что и username: один запрос `auth-status`, один ответ.

| Этап | Детали |
|------|--------|
| **Backend** | `AuthStatusView` (views.py): `request.user.profile.balance` → `str()`; при отсутствии профиля — `'0'` |
| **Модель** | `Profile.balance` (DecimalField, 10 цифр, 2 знака) |
| **API** | В ответе `auth-status`: `balance: string` |
| **Frontend** | `authStatus()` → `useAuth` сохраняет в state → Header берёт `balance` |

Баланс запрашивается вместе с ником при вызове `authStatus()`; при logout сбрасывается в `null`.

## Альтернативный источник: профиль

Полный профиль (баланс, аватар, about и т.д.) — через `GET /api/users/profile/` (UserProfileView). Для хедера достаточно `auth-status`.
