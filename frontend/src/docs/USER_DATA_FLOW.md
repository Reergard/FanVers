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
| **Frontend** | `authStatus()` → `authStatusToStorePatch` (`auth/authStatusPatch.ts`) → `setAuthAuthenticated` → store → Header берёт `balance`, `canWithdrawBalance` |

`can_withdraw_balance` / `role_self_promotion_allowed` в store оновлюються **лише якщо в JSON прийшов явний boolean**; не можна робити `Boolean(undefined)` — інакше затирається попереднє значення `false`.

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

## Чат (користувач-залежні дані + realtime)

Файли:

- `chat/ChatPage.tsx`
- `chat/store/chatStore.ts`, `chat/store/useChat.ts`
- `chat/api/chatApi.ts`
- `chat/ws/chatWs.ts`, `chat/ws/counterWs.ts`
- `widgets/header/Header.tsx`

Що важливо для auth у чаті:

- сторінка `/chat` бере `authReady`, `isAuthenticated`, `username`, `userId` із `useAuth()`;
- при `!isAuthenticated` робить редірект на `/login`;
- для HTTP-запитів чату використовується `http.ts` (Bearer + refresh/retry);
- для ws токен береться з `auth/token.ts` (`getAccess()`).

Потік даних:

1. Після авторизації `ChatPage` викликає `chatStore.fetchChats()`.
2. Вибраний чат (`selectedChatId`) синхронізується через external store.
3. При відкритті чату:
   - `fetchMessages(chatId)`,
   - `markReadLocal(chatId)` + `markChatAsRead(chatId)`.
4. Надсилання повідомлення:
   - спочатку через `chatWs.sendMessage`,
   - якщо ws не відкритий — fallback `chatApi.sendMessage`.
5. Вхідні ws події оновлюють:
   - `messagesByChatId`,
   - `last_message` у списку чатів,
   - `unreadTotal` (через store recalculation).

Header і unread:

- у `widgets/header/Header.tsx` підключений `counterWs`;
- бейдж повідомлень у хедері бере значення з `useChat().state.unreadTotal`.

Нюанс:

- у лівому списку чатів окремий бейдж unread не рендериться, але `unreadTotal` зберігається в store і використовується в Header.

## Створення книги та Налаштування книги

**Сторінка створення** (`/create-book`):

- Обгорнута в `RequireAuth` — при невдалій перевірці авторизації (authStatus/refreshSession) редірект на `/login`.
- `useBookFormMeta()` завантажує genres, tags, countries, fandoms (паралельні useQuery).
- Сабміт: `createBook` (POST FormData) → успіх → navigate на `/my-translations`.

**Сторінка налаштувань** (`/books/:slug/settings`):

- `useBookBySlug(slug)` — завантаження книги; `useAuth()` — userId.
- Перевірка: `book.owner === userId`; якщо ні — showError, navigate на книгу.
- `useBookFormMeta()` — для форми (genres, tags тощо).
- Сабміт: `updateBook(slug, payload)` (PUT FormData) → успіх → invalidateQueries(catalogKeys.book), showSuccess, navigate на книгу.

Деталі: `docs/BOOK_CREATE_SETTINGS_FLOW.md`, `backend/docs/BOOK_CREATE_UPDATE_BACKEND.md`.
