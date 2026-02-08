# Авторизация Frontend

## Обзор
- Access токен хранится в памяти (`auth/token.ts`) и отправляется в `Authorization: Bearer`.
- Refresh токен хранится в HttpOnly cookie и недоступен JavaScript.
- CSRF токен хранится в памяти (`auth/store.ts`) и отправляется в `X-CSRFToken` для refresh/logout.
- **Auth store** (`auth/store.ts`): единый стор `status` (unknown | anonymous | authenticated), `user` (userId, username, balance), `bootstrapped`, `csrfToken`. Подписка через `subscribeAuth`. При изменении — `emit()` инкрементирует `storeVersion`.

## Потоки
- **Bootstrap**: `fetchCsrfToken → refreshSessionSilent({ fromBootstrap: true }) → [если token] authStatus() → setAuthAuthenticated/setAuthAnonymous/clearAuth → markBootstrapped`.
- **Focus/visibility**: `refreshSessionSilent({ fromBootstrap: getAccess() == null })` — при отсутствии access пробует refresh (как при bootstrap); при наличии access учитывает cooldown и порог истечения. При вызове без `fromBootstrap: true` для гостя — early return, refresh не выполняется (bootstrap уже пробовал).
- **401**: `http.ts` вызывает `refreshSessionForce` (force без cooldown), делает один retry; при провале вызывает `doLogout()` и возвращает ошибку.

## Модули и ответственность
- `api/http.ts`: axios с интерцепторами, подставляет Authorization, защищен от отсутствия `error.config`, исключает refresh/logout, один retry.
- `api/httpRaw.ts`: axios без интерцепторов для refresh/logout (`withCredentials: true`).
- `auth/refreshMutex.ts`: single‑flight с cooldown 20s и режимом `force` для 401.
- `auth/refreshCore.ts`: `doRefresh` через `httpRaw` + CSRF, `refreshSessionForce` (force), `doLogout`.
- `auth/service.ts`: login/register (оптимистично `setAuthAuthenticated`, затем `authStatus`), `refreshSessionSilent` (cooldown + exp‑порог + `fromBootstrap`), `refreshSession`, `logoutSession`, `authStatus`, `refreshAuthStatus`.
- `auth/csrf.ts`: `fetchCsrfToken`, лог только при `VITE_AUTH_DEBUG=true`.
- `auth/token.ts`: access в памяти, `getJwtExpMs` с base64url padding. `subscribeAccessToken` — не используется; `useAuth` подписывается на store.
- `auth/bootstrap.ts`: `bootstrapAuth` (fetchCsrfToken → refreshSessionSilent → authStatus → setAuthAuthenticated/setAuthAnonymous/clearAuth → markBootstrapped) и `attachAuthAutoRefresh`.
- `auth/store.ts`: `csrfToken`, `bootstrapped`, `status`, `user`, `storeVersion`, `getStoreVersion`, `subscribeAuth`, `setAuthAnonymous`, `setAuthAuthenticated`, `clearAuth`.
- `auth/useAuth.ts`: подписка на store через `useSyncExternalStore(subscribeAuth, getSnapshot, getSnapshot)`. `getSnapshot` возвращает кешированный снапшот (новый объект только при изменении `storeVersion`). Возвращает `isAuthenticated`, `userId`, `username`, `balance`, `authReady` (`bootstrapped && status !== "unknown"`). **Не вызывает authStatus()** — данные поднимает bootstrap (и login/register, refreshAuthStatus).

## Правила и безопасность
- Access не хранится в `localStorage`/`sessionStorage`.
- Refresh cookie отправляется только при `withCredentials: true`.
- Refresh/logout требуют CSRF заголовок.
- Single‑flight предотвращает параллельные refresh, а 401 всегда делает force‑refresh.
