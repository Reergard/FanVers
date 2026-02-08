# Журнал изменений авторизации и профиля

Документ описывает **что именно** изменили/добавили/убрали относительно состояния, описанного в `AUTHENTICATION_FRONTEND.md` и `USER_DATA_FLOW.md`.

---

## 1. `auth/useAuth.ts`

### getSnapshot — новый объект вместо ссылки

**Было:** `return authStore` — одна и та же ссылка. `useSyncExternalStore` сравнивает по `Object.is`, React мог не перерендерить Header при мутации store.

**Стало:** `return { csrfToken, bootstrapped, status, user: { ...authStore.user } }` — каждый раз новый объект. React фиксирует изменение и перерендеривает.

### `authReady`

**Было (по AUTHENTICATION_FRONTEND.md):**
```ts
authReady = (status !== "unknown")
```

**Стало:**
```ts
authReady = s.bootstrapped && s.status !== "unknown"
```

**Смысл:** UI не зависает на "Завантаження…", если bootstrap уже завершился. Раньше при `status === "unknown"` даже после `markBootstrapped()` показывался загрузчик. Теперь `authReady` учитывает оба условия: bootstrap завершён и статус определён.

---

## 2. `auth/service.ts`

### 2.1. `refreshSessionSilent` — параметр `fromBootstrap`

**Было:**
```ts
export function refreshSessionSilent(): Promise<string | null>
```

**Стало:**
```ts
export function refreshSessionSilent(opts?: { fromBootstrap?: boolean }): Promise<string | null>
```

### 2.2. Early return для гостей (focus/visibility)

**Добавлено** в начале `refreshSessionSilent`:
```ts
if (!opts?.fromBootstrap && !getAccess()) return Promise.resolve(null);
```

**Смысл:**
- **Bootstrap** вызывает `refreshSessionSilent({ fromBootstrap: true })` — пробует refresh даже без access (F5 после логина).
- **Focus/visibility** вызывают `refreshSessionSilent()` без параметров — если `access` нет (гость), сразу возвращают `null`, не вызывая `/refresh/`. Раньше для гостей при каждом focus/visibility уходил лишний запрос на `/refresh/`.

### 2.3. Валидация access перед setAccess

**Добавлено в loginSession и registerSession:**
```ts
const access = typeof data?.access === "string" ? data.access : null;
setAccess(access);

if (!access) {
  throw new Error("Login succeeded but access token missing in response");
}
```
(В registerSession — `if (access)` вместо throw, т.к. регистрация может не возвращать access.)

Проверка `typeof` предотвращает запись `undefined`/числа/объекта — иначе `getAccess() !== null` может вести себя некорректно.

### 2.4. Оптимистичный логин/регистрация (фикс рассинхрона Header)

**Было:** После `setAccess()` пробовался `authStatus()`. При падении `authStatus()` вызывался `setAuthAnonymous()` → access оставался в памяти, но UI показывал «гостя» (Header: «Войти»). Только после F5 (bootstrap) UI обновлялся.

**Стало:** Сразу после `setAccess()` вызывается `setAuthAuthenticated({ username: payload.username, userId: null, balance: null })` — Header переключается в authenticated без ожидания `authStatus()`. Затем `authStatus()` дозагружает точные данные. При падении `authStatus()` — **не** вызываем `setAuthAnonymous()`, оставляем `authenticated`. Если токен невалидный — 401-interceptor сделает logout при следующем запросе.

### 2.5. refreshSessionSilent: синхронизация store после refresh

**Добавлено:** после успешного `doRefresh()` если получен token — вызов `refreshAuthStatus()`. Иначе Header остаётся «гостем» после восстановления сессии (focus/visibility после сна).

### 2.6. attachAuthAutoRefresh: refresh при отсутствии access

**Было:** `refreshSessionSilent()` без параметров → ранний return при `!getAccess()` → refresh не вызывался.

**Стало:** `refreshSessionSilent({ fromBootstrap: getAccess() == null })` — при отсутствии access (после сна/выгрузки) пробуем refresh. Фикс «утром разлогинен», когда refresh-cookie ещё валидна.

### 2.7. Функция `refreshAuthStatus`

**Добавлена** новая функция:
```ts
export async function refreshAuthStatus(): Promise<void> {
  const token = getAccess();
  if (!token) return;
  try {
    const userData = await authStatus();
    setAuthAuthenticated({
      userId: userData?.userId ?? null,
      username: userData?.username ?? null,
      balance: userData?.balance ?? null,
    });
  } catch {
    // Ignore — не сбрасываем, если сервер временно недоступен
  }
}
```

**Назначение:** Обновить auth store (username, balance) после операций deposit/withdraw на странице профиля, чтобы хедер и другие компоненты сразу видели новый баланс.

---

## 3. `auth/bootstrap.ts`

### Вызов `refreshSessionSilent`

**Было:**
```ts
await refreshSessionSilent();
```

**Стало:**
```ts
await refreshSessionSilent({ fromBootstrap: true });
```

**Смысл:** При F5 без access (гость или кука ещё жива) bootstrap всё равно пробует refresh. Без этого флага `refreshSessionSilent` сразу возвращал бы `null` для гостей (из-за early return).

### Обработка StrictMode

**Добавлено** в блоке `catch`:
```ts
if (!getAccess()) {
  setAuthAnonymous();
}
```

**Было:** При ошибке bootstrap всегда вызывал `setAuthAnonymous()`.

**Стало:** `setAuthAnonymous()` вызывается только если `!getAccess()`. Если при StrictMode первый run bootstrap успел, а второй упал — не перезаписываем authenticated.

---

## 4. `auth/attachAuthAutoRefresh` (в `bootstrap.ts`)

Вызов `refreshSessionSilent()` без параметров — без изменений.  
Для focus/visibility `opts?.fromBootstrap` будет `undefined`, поэтому для гостей (нет access) ранний return сработает и запрос на `/refresh/` не выполнится.

---

## 5. `users/service.ts` → `users/profileService.ts`

### Переименование файла

- **Удалён:** `frontend/src/users/service.ts`
- **Создан:** `frontend/src/users/profileService.ts` (тот же код)

**Причина:** Избежать путаницы с `auth/service.ts`. Оба назывались `service.ts`.

### Импорты

- `Profile.tsx`: импорт изменён с `./service` на `./profileService`.

---

## 6. `users/Profile.tsx`

### 6.1. Импорт `refreshAuthStatus`

**Добавлено:**
```ts
import { refreshAuthStatus } from "../auth/service";
```

### 6.2. Импорт профильных функций

**Было:**
```ts
} from "./service";
```

**Стало:**
```ts
} from "./profileService";
```

### 6.3. `validateAvatarMagicBytes`

**Добавлена** функция проверки сигнатуры файла (magic bytes):
```ts
async function validateAvatarMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // JPEG: FF D8 FF
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    // WebP: RIFF....WEBP
    const isWebp = bytes.length >= 12 && bytes[0] === 0x52 && ...;
    return isJpeg || isPng || isWebp;
  } catch {
    return false;
  }
}
```

**Использование:** В `handleAvatarChange` после `validateAvatarFile` вызывается `validateAvatarMagicBytes`; при `false` — ошибка "Невірний формат файлу або файл пошкоджений".

### 6.4. `parseBalance`

**Добавлена** функция:
```ts
function parseBalance(value: string | number | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}
```

**Использование:** Парсинг `profile.balance` (учёт пробелов и запятой) при проверке суммы при выводе и отображении баланса.

### 6.5. `depositMutation` / `withdrawMutation`

**Добавлено** в `onSuccess`:
- `await refreshAuthStatus();` — обновление auth store (balance в хедере)
- `setBalanceHistory(data?.balance_history ?? []);` — сохранение истории транзакций из ответа

### 6.6. `useState` для `balanceHistory`

**Добавлено:**
```ts
const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
```

### 6.7. Проверка `authReady`

**Есть** блок:
```ts
if (!authReady) {
  return ( ... "Завантаження..." );
}
```

Используется новое значение `authReady` из `useAuth()` (`bootstrapped && status !== "unknown"`).

---

## 7. `users/types.ts`

### `BalanceHistoryItem`

**Добавлен** тип:
```ts
export type BalanceHistoryItem = {
  amount?: number;
  type?: string;
  created_at?: string;
  date?: string;
};
```

**Использование:** В `profileService.ts` для `depositBalance`/`withdrawBalance` (`balance_history?: BalanceHistoryItem[]`) и в `Profile.tsx` для `useState<BalanceHistoryItem[]>`.

---

## 8. `users/profileService.ts`

### Типизация `depositBalance` / `withdrawBalance`

**Добавлено** в возвращаемый тип:
```ts
balance_history?: BalanceHistoryItem[];
```

Импорт: `import type { ..., BalanceHistoryItem } from "./types"`.

---

## 9. Файлы без изменений

Следующие файлы **не менялись** в рамках этих правок:

- `auth/token.ts` — access в памяти, `getJwtExpMs`
- `auth/store.ts` — status, user, bootstrapped, subscribeAuth
- `auth/refreshCore.ts` — doRefresh, refreshSessionForce, doLogout
- `auth/refreshMutex.ts` — cooldown 20s, force для 401
- `auth/authLogger.ts`, `auth/authSelfTest.ts`
- `auth/csrf.ts`, `auth/LoginForm.tsx`, `auth/RegisterForm.tsx`, `auth/RequireAuth.tsx`
- `api/http.ts` — 401 → refreshSessionForce → retry → doLogout
- `api/httpRaw.ts`, `api/endpoints.ts`

---

## 10. Проверка `clearAuth` (auth/store.ts)

При падении `authStatus()` в bootstrap вызывается `clearAuth()`. Важно, чтобы `status` не оставался `"unknown"`, иначе `authReady` застрянет в `false` и UI покажет вечную «Завантаження…».

**Проверено:** `clearAuth()` устанавливает `authStore.status = "anonymous"` (стр. 65), а не `"unknown"`. Крайний случай не возникает.

---

## 11. Сводка по документации

| Документ | Актуальность |
|----------|--------------|
| `AUTHENTICATION_FRONTEND.md` | Частично устарел: `authReady` теперь `bootstrapped && status !== "unknown"`; `refreshSessionSilent` принимает `opts.fromBootstrap`; не упомянута `refreshAuthStatus`. |
| `USER_DATA_FLOW.md` | Описывает старую схему, где `useAuth` подписывался на `subscribeAccessToken` и вызывал `authStatus()`. Сейчас используется `subscribeAuth` на store, `authStatus` вызывают bootstrap, login, register и `refreshAuthStatus`. |

---

## Примечание

Если в твоей локальной версии `Profile.tsx` отсутствуют `validateAvatarMagicBytes`, `parseBalance` или `BalanceHistoryItem` — проверь, что файл сохранён и ты в правильной ветке. В текущем репозитории эти изменения присутствуют (строки 40–66, 71–75, 126, 242, 293, 345).
