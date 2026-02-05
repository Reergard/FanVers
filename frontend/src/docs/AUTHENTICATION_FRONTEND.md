# Авторизация Frontend

## Обзор
- Access токен хранится в памяти (`auth/token.ts`) и отправляется в `Authorization: Bearer`.
- Refresh токен хранится в HttpOnly cookie и недоступен JavaScript.
- CSRF токен хранится в памяти (`auth/store.ts`) и отправляется в `X-CSRFToken` для refresh/logout.
- **Auth store** (`auth/store.ts`): единый стор `status` (unknown | anonymous | authenticated), `user` (userId, username, balance), подписка через `subscribeAuth`. `useAuth()` — только подписка на стор, не вызывает `authStatus()`.

## Потоки
- **Bootstrap**: `fetchCsrfToken → refreshSessionSilent → [если token] authStatus() → setAuthAuthenticated/setAuthAnonymous → markBootstrapped`.
- **Focus/visibility**: `refreshSessionSilent` учитывает cooldown и порог истечения access.
- **401**: `http.ts` вызывает `refreshSessionForce` (force без cooldown), делает один retry; при провале вызывает `doLogout()` и возвращает ошибку.

## Модули и ответственность
- `api/http.ts`: axios с интерцепторами, подставляет Authorization, защищен от отсутствия `error.config`, исключает refresh/logout, один retry.
- `api/httpRaw.ts`: axios без интерцепторов для refresh/logout (`withCredentials: true`).
- `auth/refreshMutex.ts`: single‑flight с cooldown 20s и режимом `force` для 401.
- `auth/refreshCore.ts`: `doRefresh` через `httpRaw` + CSRF, `refreshSessionForce` (force), `doLogout`.
- `auth/service.ts`: login/register (после успеха вызывают `authStatus` и `setAuthAuthenticated`), `refreshSessionSilent` (cooldown + exp‑порог), `refreshSession`, `logoutSession`, `authStatus`.
- `auth/csrf.ts`: `fetchCsrfToken`, лог только при `VITE_AUTH_DEBUG=true`.
- `auth/token.ts`: access в памяти, подписка, `getJwtExpMs` с base64url padding.
- `auth/bootstrap.ts`: `bootstrapAuth` (fetchCsrfToken → refreshSessionSilent → authStatus → setAuthAuthenticated/setAuthAnonymous → markBootstrapped) и `attachAuthAutoRefresh`.
- `auth/store.ts`: `csrfToken`, `bootstrapped`, `status`, `user`, `subscribeAuth`, `setAuthAnonymous`, `setAuthAuthenticated`, `clearAuth`.
- `auth/useAuth.ts`: подписка на store через `useSyncExternalStore`; возвращает `isAuthenticated`, `userId`, `username`, `balance`, `authReady` (status !== "unknown"). **Не вызывает authStatus()** — данные поднимает bootstrap (и login/register).

## Правила и безопасность
- Access не хранится в `localStorage`/`sessionStorage`.
- Refresh cookie отправляется только при `withCredentials: true`.
- Refresh/logout требуют CSRF заголовок.
- Single‑flight предотвращает параллельные refresh, а 401 всегда делает force‑refresh.
