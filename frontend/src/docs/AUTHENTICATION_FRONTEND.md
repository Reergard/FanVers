# Система авторизации Frontend

## 📋 Содержание

1. [Архитектура](#архитектура)
2. [Структура файлов](#структура-файлов)
3. [Логика работы токенов](#логика-работы-токенов)
4. [Детальное описание модулей](#детальное-описание-модулей)
5. [Потоки авторизации](#потоки-авторизации)
6. [Безопасность](#безопасность)
7. [Интеграция с бекендом](#интеграция-с-бекендом)

---

## Архитектура

Система авторизации использует гибридный подход с разделением ответственности:

- **Access токен** — хранится только в памяти (`token.ts`), передаётся в заголовке `Authorization: Bearer <token>`
  - Время жизни: 15 минут
  - Используется для доступа к защищённым эндпоинтам
  - **НЕ хранится** в localStorage/sessionStorage (защита от XSS)

- **Refresh токен** — хранится в HttpOnly cookie (недоступен для JavaScript)
  - Время жизни: 7 дней
  - Используется только для обновления access токена
  - Refresh cookie может отправляться браузером на запросы к API (при `withCredentials: true`), но используется сервером только на refresh/logout

- **CSRF токен** — хранится в памяти (`authStore`), передаётся в заголовке `X-CSRFToken`
  - Требуется только для операций с refresh cookie (refresh/logout)
  - Получается через `GET /api/users/csrf/` при старте приложения

### Ключевые принципы

1. **Single-flight mutex** — все refresh операции проходят через `runSingleFlight()` для предотвращения параллельных запросов
2. **Разделение axios инстансов** — `http` (с интерцепторами) для обычных запросов, `httpRaw` (без интерцепторов) для refresh/logout
3. **Автоматический refresh** — при 401 на любом запросе автоматически выполняется refresh с повторной попыткой
4. **Bootstrap** — восстановление сессии при старте и автообновление при фокусе/видимости вкладки

---

## Структура файлов

```
src/
├── api/
│   ├── endpoints.ts      # Константы эндпоинтов API
│   ├── http.ts          # Основной axios instance с интерцепторами
│   └── httpRaw.ts       # Чистый axios instance без интерцепторов
│
└── auth/
    ├── token.ts         # Хранение access токена в памяти
    ├── store.ts         # Состояние авторизации (CSRF, bootstrapped)
    ├── csrf.ts          # Получение CSRF токена
    ├── refreshMutex.ts  # Single-flight mutex для refresh
    ├── refreshCore.ts   # Внутренние функции refresh/logout (без mutex)
    ├── service.ts       # Публичные функции авторизации (с mutex)
    ├── bootstrap.ts     # Инициализация при старте + автообновление
    └── RequireAuth.tsx  # Компонент для защищённых маршрутов
```

---

## Логика работы токенов

### Access токен

**Хранение:** Переменная в памяти (`token.ts`)
```typescript
let accessToken: string | null = null;
```

**Использование:**
- Автоматически добавляется в `Authorization: Bearer <token>` через request interceptor в `http.ts`
- Читается через `getAccess()` перед каждым запросом
- Устанавливается через `setAccess()` после успешного login/register/refresh

**Важно:** При перезагрузке страницы access токен теряется (он в памяти), но может быть восстановлен через refresh cookie.

### Refresh токен

**Хранение:** HttpOnly cookie (устанавливается бекендом)

**Использование:**
- Refresh cookie может отправляться браузером на запросы к API (при `withCredentials: true`), но используется сервером только на refresh/logout
- Недоступен для JavaScript (защита от XSS)

**Ротация:** При каждом refresh бекенд создаёт новый refresh токен и добавляет старый в blacklist.

### CSRF токен

**Хранение:** Память (`authStore.csrfToken`)

**Получение:** `GET /api/users/csrf/` при старте приложения

**Использование:** Отправляется в заголовке `X-CSRFToken` для всех операций с refresh cookie (refresh/logout)

---

## Детальное описание модулей

### `api/endpoints.ts`

Константы всех эндпоинтов авторизации:

```typescript
export const API = {
  csrf: "/api/users/csrf/",
  login: "/api/users/login/",
  register: "/api/users/register/",
  refresh: "/api/users/refresh/",
  logout: "/api/users/logout/",
  authStatus: "/api/users/auth-status/",
} as const;
```

**Назначение:** Единая точка правды для путей API, упрощает рефакторинг и предотвращает опечатки.

---

### `api/httpRaw.ts`

Чистый axios instance без интерцепторов:

```typescript
export const httpRaw = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  withCredentials: true,
});
```

**Назначение:**
- Используется для refresh/logout операций
- Избегает циклических зависимостей и рекурсии в интерцепторах
- Не добавляет `Authorization` заголовок автоматически

**Важно:** `withCredentials: true` обязательно для отправки refresh cookie.

---

### `api/http.ts`

Основной axios instance с интерцепторами:

**Request interceptor:**
- Автоматически добавляет `Authorization: Bearer <access_token>` если токен есть в памяти

**Response interceptor:**
- При 401 на любом запросе (кроме refresh/logout):
  1. Сохраняет состояние до refresh (`hadAccessBeforeRefresh`)
  2. Вызывает `runSingleFlight(() => doRefresh())` через mutex
  3. Повторяет исходный запрос один раз
  4. Если refresh не удался:
     - Если был access токен → вызывает `doLogout()` для очистки состояния
     - Если не было access токена (гость) → просто возвращает 401 без logout

**Защита от циклов:**
- Использует флаг `_retry` для предотвращения повторных попыток
- Исключает refresh/logout эндпоинты из обработки 401

---

### `auth/token.ts`

Хранение access токена в памяти:

```typescript
let accessToken: string | null = null;

export function setAccess(token: string | null)
export function getAccess(): string | null
export function getJwtExpMs(token: string): number | null
```

**Важно:** Access токен **никогда** не сохраняется в localStorage/sessionStorage для защиты от XSS атак.

---

### `auth/store.ts`

Состояние авторизации:

```typescript
export const authStore = {
  csrfToken: string | null,
  bootstrapped: boolean,
};
```

**Функции:**
- `setCsrf(token)` — установка CSRF токена
- `markBootstrapped()` — отметка о выполнении bootstrap
- `clearAuth()` — очистка состояния (access токен + CSRF токен)

**Важно:** `bootstrapped` флаг не сбрасывается при logout — он показывает, что bootstrap был выполнен в этом запуске приложения.

---

### `auth/csrf.ts`

Получение CSRF токена:

```typescript
export async function fetchCsrfToken()
```

**Логика:**
- Использует прямой axios вызов (не `http`), чтобы избежать циклических зависимостей и побочных эффектов
- Сохраняет токен в `authStore.csrfToken`
- Вызывается при старте приложения (bootstrap) и при необходимости перед refresh/logout

---

### `auth/refreshMutex.ts`

Single-flight mutex для предотвращения параллельных refresh:

```typescript
let inflight: Promise<string> | null = null;

export function runSingleFlight(fn: () => Promise<string>)
```

**Логика:**
- Если refresh уже выполняется (`inflight !== null`), возвращает существующий Promise
- Если нет — создаёт новый Promise и очищает после завершения
- Гарантирует, что одновременно выполняется только один refresh запрос

**Критично:** Без mutex параллельные refresh могут привести к ситуации, когда первый refresh ротирует токен и заносит старый в blacklist, а второй прилетает со старым токеном → 401 → разлогин.

---

### `auth/refreshCore.ts`

Внутренние функции refresh/logout без mutex:

```typescript
export async function doRefresh(): Promise<string>
export async function doLogout()
```

**Особенности:**
- Используют `httpRaw` (без интерцепторов) для избежания рекурсии
- Проверяют наличие CSRF токена и получают его при необходимости
- `doRefresh()` устанавливает новый access токен через `setAccess()`
- `doLogout()` всегда вызывает `clearAuth()` в `finally` блоке

**Важно:** Эти функции **не должны** вызываться напрямую из компонентов. Используйте `refreshSession()` и `logoutSession()` из `service.ts`.

---

### `auth/service.ts`

Публичные функции авторизации:

```typescript
export async function loginSession(payload)
export async function registerSession(payload)
export function refreshSession()  // С mutex!
export async function logoutSession()
export async function authStatus()
```

**Ключевые моменты:**

1. **`refreshSession()`** — всегда использует `runSingleFlight(doRefresh)`
   - Все вызовы из bootstrap, RequireAuth, attachAuthAutoRefresh автоматически защищены mutex

2. **`loginSession()` / `registerSession()`** — используют `http` (с интерцепторами)
   - CSRF не требуется (csrf_exempt на бекенде)
   - После успешного ответа устанавливают access токен

3. **`logoutSession()`** — вызывает `doLogout()` из `refreshCore.ts`
   - Использует `httpRaw` для избежания попадания в интерцепторы

4. **`authStatus()`** — использует `http` (требует access токен)
   - При 401 автоматически сработает interceptor → refresh → retry

---

### `auth/bootstrap.ts`

Инициализация авторизации при старте приложения:

```typescript
export async function bootstrapAuth()
export function attachAuthAutoRefresh()
```

**`bootstrapAuth()`:**
1. Получает CSRF токен через `fetchCsrfToken()`
2. Пытается восстановить access токен через `refreshSession()` (использует refresh cookie)
3. Если refresh не удался (гость или refresh истёк) — игнорирует ошибку
4. Отмечает bootstrap как выполненный

**`attachAuthAutoRefresh()`:**
- Устанавливает слушатели на `focus` и `visibilitychange` события
- При фокусе/пробуждении вкладки вызывает `refreshSession()` для обновления access токена
- Возвращает функцию очистки слушателей

**Интеграция:** Вызывается в `App.tsx` при монтировании компонента.

---

### `auth/RequireAuth.tsx`

Компонент для защищённых маршрутов:

```typescript
export function RequireAuth({ children })
```

**Логика:**
1. При монтировании проверяет `authStatus()`
2. Если 401 → пытается `refreshSession()` → повторно проверяет `authStatus()`
3. Если успешно → рендерит children
4. Если не удалось → редиректит на `/login`

**Состояния:**
- `ok === null` → загрузка (можно показать прелоадер)
- `ok === false` → не авторизован → редирект
- `ok === true` → авторизован → рендер children

---

## Потоки авторизации

### 1. Старт приложения

```
App.tsx монтируется
  ↓
bootstrapAuth()
  ↓
fetchCsrfToken() → GET /api/users/csrf/
  ↓
refreshSession() → runSingleFlight(doRefresh)
  ↓
doRefresh() → POST /api/users/refresh/ (с CSRF + refresh cookie)
  ↓
setAccess(data.access) → access токен в памяти
  ↓
markBootstrapped() → готово к работе
```

**Если refresh не удался:** Пользователь остаётся гостем, bootstrap завершается без ошибки.

---

### 2. Логин

```
loginSession({ username, password })
  ↓
http.post(API.login) → POST /api/users/login/
  ↓
Бекенд: проверка credentials → установка refresh cookie → возврат access
  ↓
setAccess(data.access) → access токен в памяти
```

**Важно:** CSRF не требуется (csrf_exempt на бекенде).

---

### 3. Обычный API запрос

```
Компонент вызывает http.get("/api/users/profile/")
  ↓
Request interceptor: добавляет Authorization: Bearer <access>
  ↓
Запрос уходит на бекенд
  ↓
Если 401:
  ↓
Response interceptor: сохраняет hadAccessBeforeRefresh
  ↓
runSingleFlight(() => doRefresh()) → refresh через mutex
  ↓
doRefresh() → POST /api/users/refresh/ (httpRaw, без интерцепторов)
  ↓
setAccess(new_access) → новый токен в памяти
  ↓
Повтор исходного запроса с новым токеном
```

**Если refresh не удался:**
- Если был access токен → `doLogout()` → очистка состояния
- Если не было access токена (гость) → просто возвращает 401

---

### 4. Автообновление при фокусе

```
Пользователь переключается на вкладку
  ↓
window.addEventListener("focus") → safeRefresh()
  ↓
refreshSession() → runSingleFlight(doRefresh)
  ↓
doRefresh() → обновление access токена
```

**Цель:** Обновить access токен "тихо", чтобы не ловить 401 на первом же клике после возврата на вкладку.

---

### 5. Logout

```
logoutSession()
  ↓
doLogout()
  ↓
httpRaw.post(API.logout) → POST /api/users/logout/ (с CSRF)
  ↓
Бекенд: добавляет refresh токен в blacklist → удаляет cookie
  ↓
clearAuth() → очистка access токена и CSRF токена
```

**Важно:** Использует `httpRaw` для избежания попадания в интерцепторы.

---

## Безопасность

### Защита от XSS

1. **Access токен в памяти** — недоступен для XSS скриптов (не в localStorage)
2. **Refresh токен в HttpOnly cookie** — JavaScript не может прочитать
3. **CSRF защита** — все операции с refresh cookie требуют CSRF токен

### Защита от параллельных refresh

**Single-flight mutex** гарантирует:
- Одновременно выполняется только один refresh запрос
- Все параллельные вызовы ждут один общий refresh
- Предотвращает ситуацию с ротацией токенов и blacklist

### Защита от циклов

1. **Флаг `_retry`** — предотвращает повторные попытки refresh на одном запросе
2. **Исключение refresh/logout** — эти эндпоинты не обрабатываются interceptor'ом
3. **Разделение инстансов** — refresh/logout используют `httpRaw` без интерцепторов

### Обработка гостей

- При 401 без access токена не вызывается logout (нет состояния для очистки)
- Гости не получают ошибки при неудачном refresh в bootstrap

---

## Интеграция с бекендом

### Эндпоинты

Все эндпоинты соответствуют бекенду (`/api/users/...`):

- `GET /api/users/csrf/` — получение CSRF токена (GET, CSRF не требуется)
- `POST /api/users/login/` — вход (csrf_exempt)
- `POST /api/users/register/` — регистрация (csrf_exempt)
- `POST /api/users/refresh/` — обновление токенов (требует CSRF)
- `POST /api/users/logout/` — выход (требует CSRF)
- `GET /api/users/auth-status/` — проверка статуса (требует access токен)

### Формат запросов

**Login/Register:**
```http
POST /api/users/login/
Content-Type: application/json
Cookie: (автоматически)

{
  "username": "user",
  "password": "pass"
}
```

**Refresh:**
```http
POST /api/users/refresh/
X-CSRFToken: <csrf_token>
Cookie: refresh_token=<refresh_token>
```

**Logout:**
```http
POST /api/users/logout/
X-CSRFToken: <csrf_token>
Cookie: refresh_token=<refresh_token>
```

**Обычные запросы:**
```http
GET /api/users/profile/
Authorization: Bearer <access_token>
```

Авторизация — через `Authorization` заголовок. Cookie `refresh_token` может присутствовать автоматически (браузер отправляет при `withCredentials: true`), но не является механизмом доступа к protected endpoints.

### Ответы бекенда

**Login/Register:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```
+ Устанавливается `refresh_token` cookie (HttpOnly)

**Refresh:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```
+ Обновляется `refresh_token` cookie (ротация)

**Logout:**
```
205 Reset Content
```
+ Удаляется `refresh_token` cookie

**Auth Status:**
```json
{
  "isAuthenticated": true
}
```
или `401 Unauthorized` если токен невалиден

---

## Важные моменты

1. **Все refresh проходят через mutex** — `refreshSession()` всегда использует `runSingleFlight()`
2. **Refresh/logout используют httpRaw** — избегают попадания в интерцепторы
3. **CSRF получается при старте** — bootstrap вызывает `fetchCsrfToken()`
4. **Access токен только в памяти** — никогда не сохраняется в storage
5. **Автоматический refresh на 401** — interceptor обрабатывает все запросы
6. **Bootstrap восстанавливает сессию** — при перезагрузке страницы access восстанавливается через refresh cookie
7. **Автообновление при фокусе** — вкладка "просыпается" → refresh токена

---

## Использование

### В компонентах

```typescript
import { loginSession, logoutSession, authStatus } from "../auth/service";
import { http } from "../api/http";

// Логин
await loginSession({ username: "user", password: "pass" });

// API запрос (автоматически добавит Authorization)
const profile = await http.get("/api/users/profile/");

// Logout
await logoutSession();
```

### Защищённые маршруты

```typescript
import { RequireAuth } from "../auth/RequireAuth";

<Route path="/profile" element={
  <RequireAuth>
    <Profile />
  </RequireAuth>
} />
```

### Настройка

Убедитесь, что в `.env` установлен:
```
VITE_API_BASE_URL=http://127.0.0.1:8000
```
