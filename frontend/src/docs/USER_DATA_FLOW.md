# Данные пользователя на Frontend

## Схема

```
Backend (AuthStatusView)  →  authStatus()  →  setAuthAuthenticated()  →  auth store  →  useAuth()  →  компоненты (Header)
       ↑                          ↑                    ↑                    ↑
  GET /api/users/auth-status/   service.ts           store.ts           subscribeAuth
  Bearer access                 http.get()           emit()              useSyncExternalStore
```

**Кто вызывает authStatus():**
- `bootstrapAuth` — после refreshSessionSilent, если есть access
- `loginSession` / `registerSession` — после успешного логина/регистрации
- `refreshAuthStatus` — после doRefresh, при deposit/withdraw (Profile)

## Файлы и роли

| Файл | Назначение |
|------|------------|
| `api/endpoints.ts` | `API.authStatus` → `/api/users/auth-status/` |
| `api/http.ts` | Axios-клиент: подставляет `Authorization: Bearer {access}`, при 401 — refresh и retry |
| `auth/token.ts` | Access-токен в памяти, `getAccess()` / `setAccess()`. `subscribeAccessToken` не используется; useAuth подписывается на store |
| `auth/store.ts` | store (status, user, bootstrapped), `subscribeAuth`, `emit`, `storeVersion` |
| `auth/service.ts` | `authStatus()` — `http.get(API.authStatus)` → возвращает `{ isAuthenticated, userId, username, balance }`; `refreshAuthStatus()` — обновляет store |
| `auth/useAuth.ts` | Хук: подписка на store через `useSyncExternalStore`; возвращает `{ isAuthenticated, userId, username, balance, authReady }` |

## Важно

- **`useAuth.isAuthenticated`** определяется `status === "authenticated"` в store, а не наличием access в памяти. Store синхронизируется bootstrap/login/register/refreshAuthStatus.
- **`authStatus()`** идёт через `http.ts`, поэтому при 401 может автоматически пройти refresh и один retry.

## Backend

- **Эндпоинт:** `GET /api/users/auth-status/`
- **Авторизация:** JWT в `Authorization: Bearer`
- **Ответ:** `{ isAuthenticated: true, userId: number, username: string, balance: string }`

## Использование

```ts
const { isAuthenticated, userId, username, balance, authReady } = useAuth();
// userId — id пользователя при авторизации (для Owner vs Reader в каталоге), иначе null
// username — ник (user.username) при авторизации, иначе null
// balance — баланс (profile.balance) при авторизации, иначе null
// authReady — bootstrapped && status !== "unknown" (можно показывать загрузку)
```

## Баланс

Тот же путь, что и username: один запрос `auth-status`, один ответ.

| Этап | Детали |
|------|--------|
| **Backend** | `AuthStatusView` (views.py): `request.user.profile.balance` → `str()`; при отсутствии профиля — `'0'` |
| **Модель** | `Profile.balance` (DecimalField, 10 цифр, 2 знака) |
| **API** | В ответе `auth-status`: `balance: string` |
| **Frontend** | `authStatus()` → `setAuthAuthenticated` → store → Header берёт `balance` |

Баланс запрашивается вместе с ником при вызове `authStatus()`; при logout сбрасывается в `null`.

## Альтернативный источник: профиль

Полный профиль (баланс, аватар, about и т.д.) — через `GET /api/users/profile/` (UserProfileView). Для хедера достаточно `auth-status`. После deposit/withdraw на странице Profile вызывается `refreshAuthStatus()` для обновления баланса в store и Header.

## Страница "Покинуті переклади" и auth

- Страница: `catalog/AbandonedTranslations.tsx`
- API: `GET /api/catalog/abandoned-translations/` через `api/catalogApi.ts`

Важно:

- Эта страница **не зависит от `useAuth()`** для загрузки списка книг.
- Запрос идет через `http.ts`, поэтому если access-токен в памяти есть — он автоматически добавится в Bearer.
- Если access нет, страница все равно может работать (endpoint на backend сейчас публичный по default permission `AllowAny`).

## Глобальная настройка 18+ (hideAdultContent)

Добавлен отдельный фронтенд-store для настройки 18+:

- `settings/adultContentStore.ts`
- `settings/useAdultContent.ts`

Как работает:

1. Источник истины — `localStorage` ключ `hideAdultContent`.
2. Подписка на изменения — `useSyncExternalStore`.
3. Межвкладочная синхронизация — через событие `storage` (`window.addEventListener("storage", ...)`).

Где используется:

- `search/search.tsx`: в запрос поиска уходит `adult_content = !hideAdultContent`.
- `users/Profile.tsx`: чекбокс "Прибрати 18+" работает через этот store; при включении показывается modal подтверждения.

Важно:

- Настройка `hideAdultContent` теперь реактивная и общая для страниц, но это отдельный frontend-store (не auth-store).

## Пошук і закладки (користувач-залежні дані)

На сторінці `search/search.tsx` використовуються user-залежні поля з результату пошуку:

- `bookmark_status`
- `bookmark_id`

Як це працює:

1. Пошук викликає `GET /api/search/book-search/`.
2. Backend віддає `bookmark_status/bookmark_id` через `BookReaderSerializer` для авторизованого користувача.
3. На фронті `searchApi.ts` нормалізує ці поля.
4. Чекбокс `Не показувати закладки` (`hideBookmarks`) фільтрує книги клієнтськи: ховає книги, де `bookmark_status !== null`.

Нюанс:

- для гостя перемикання `hideBookmarks` не застосовується (показується warning «Увійдіть, щоб приховати закладки»).

## UI-стан фільтрів пошуку (Dropdown)

На `search/search.tsx` фільтри (`genres/tags/fandoms/...` та `min/max chapters`) відкриваються через `navigation/FilterDropdown.tsx`.

Що важливо для поведінки:

- dropdown прив’язується до натиснутого фільтра (`anchorEl`);
- під час відкриття блокується скрол сторінки через `useScrollLock`;
- сам вибір у dropdown (multi-select) змінює локальний `filters` state, який далі йде в `searchBooks` (через debounced `effectiveFilters`).
