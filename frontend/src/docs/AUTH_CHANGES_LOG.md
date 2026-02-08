# Журнал изменений авторизации и профиля

Документ описывает **что именно** изменили/добавили/убрали в auth-модуле. Актуальное состояние — в `AUTHENTICATION_FRONTEND.md` и `USER_DATA_FLOW.md`.

---

## 1. `auth/useAuth.ts`

### getSnapshot — кеширование снапшота (фикс чёрного экрана)

**Было:** `return { ...authStore, user: { ...authStore.user } }` — каждый раз новый объект. `useSyncExternalStore` вызывает getSnapshot при каждом рендере. React сравнивает по `Object.is` — новый объект = изменение → бесконечный цикл ре-рендеров, чёрный экран.

**Стало:** Кеширование снапшота по `storeVersion`. В `store.ts` при каждом `emit()` инкрементируется `storeVersion`. `getSnapshot()` возвращает новый объект только когда `getStoreVersion()` изменился; иначе — тот же `cachedSnapshot`.

### `authReady`

```ts
authReady = s.bootstrapped && s.status !== "unknown"
```

**Смысл:** UI не зависает на "Завантаження…", если bootstrap уже завершился. Учитываются оба условия: bootstrap завершён и статус определён.

---

## 2. `auth/store.ts`

### storeVersion и getStoreVersion

**Добавлено:** При каждом вызове `emit()` инкрементируется `storeVersion`. Экспортируется `getStoreVersion()` для `useAuth.getSnapshot()` — чтобы создавать новый снапшот только при реальном изменении store.

---

## 3. `auth/service.ts`

### 3.1. `refreshSessionSilent` — параметр `fromBootstrap`

```ts
export function refreshSessionSilent(opts?: { fromBootstrap?: boolean }): Promise<string | null>
```

### 3.2. Early return для гостей (focus/visibility)

В начале `refreshSessionSilent`:
```ts
if (!opts?.fromBootstrap && !getAccess()) return Promise.resolve(null);
```

**Смысл:**
- **Bootstrap** вызывает `refreshSessionSilent({ fromBootstrap: true })` — пробует refresh даже без access (F5 после логина).
- **Focus/visibility** вызывают `refreshSessionSilent({ fromBootstrap: getAccess() == null })` — при отсутствии access пробуют refresh (фикс «утром разлогинен»).

### 3.3. Оптимистичный логин/регистрация (фикс рассинхрона Header)

**Было:** После `setAccess()` пробовался `authStatus()`. При падении `authStatus()` вызывался `setAuthAnonymous()` → access оставался в памяти, но UI показывал «гостя» (Header: «Войти»). Только после F5 (bootstrap) UI обновлялся.

**Стало:** Сразу после `setAccess()` вызывается `setAuthAuthenticated({ username: payload.username, userId: null, balance: null })` — Header переключается в authenticated без ожидания `authStatus()`. Затем `authStatus()` дозагружает точные данные. При падении `authStatus()` — **не** вызываем `setAuthAnonymous()`, оставляем `authenticated`. Если токен невалидный — 401-interceptor сделает logout при следующем запросе.

### 3.4. refreshSessionSilent: синхронизация store после refresh

После успешного `doRefresh()` если получен token — вызов `refreshAuthStatus()`. Иначе Header остаётся «гостем» после восстановления сессии (focus/visibility после сна).

### 3.5. Функция `refreshAuthStatus`

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

## 4. `auth/bootstrap.ts`

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

## 5. `auth/attachAuthAutoRefresh` (в `bootstrap.ts`)

Вызов `refreshSessionSilent({ fromBootstrap: getAccess() == null })` — при отсутствии access пробует refresh (как при bootstrap).

---

## 6. `users/service.ts` → `users/profileService.ts`

### Переименование файла

- **Удалён:** `frontend/src/users/service.ts`
- **Создан:** `frontend/src/users/profileService.ts` (тот же код)

**Причина:** Избежать путаницы с `auth/service.ts`. Оба назывались `service.ts`.

### Импорты

- `Profile.tsx`: импорт изменён с `./service` на `./profileService`.

---

## 7. `users/Profile.tsx`

### 7.1. Импорт `refreshAuthStatus`

**Добавлено:**
```ts
import { refreshAuthStatus } from "../auth/service";
```

### 7.2. Импорт профильных функций

**Было:**
```ts
} from "./service";
```

**Стало:**
```ts
} from "./profileService";
```

### 7.3. `validateAvatarMagicBytes`

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

### 7.4. `parseBalance`

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

### 7.5. `depositMutation` / `withdrawMutation`

**Добавлено** в `onSuccess`:
- `await refreshAuthStatus();` — обновление auth store (balance в хедере)
- `setBalanceHistory(data?.balance_history ?? []);` — сохранение истории транзакций из ответа

### 7.6. `useState` для `balanceHistory`

**Добавлено:**
```ts
const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
```

### 7.7. Проверка `authReady`

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

## 9. `users/profileService.ts`

### Типизация `depositBalance` / `withdrawBalance`

**Добавлено** в возвращаемый тип:
```ts
balance_history?: BalanceHistoryItem[];
```

Импорт: `import type { ..., BalanceHistoryItem } from "./types"`.

---

## 10. Файлы без изменений

Следующие файлы **не менялись** в рамках этих правок:

- `auth/token.ts` — access в памяти, `getJwtExpMs`, `subscribeAccessToken` (useAuth не использует — подписывается на store)
- `auth/refreshCore.ts` — doRefresh, refreshSessionForce, doLogout
- `auth/refreshMutex.ts` — cooldown 20s, force для 401
- `auth/authLogger.ts`, `auth/authSelfTest.ts`
- `auth/csrf.ts`, `auth/LoginForm.tsx`, `auth/RegisterForm.tsx`, `auth/RequireAuth.tsx`
- `api/http.ts` — 401 → refreshSessionForce → retry → doLogout
- `api/httpRaw.ts`, `api/endpoints.ts`

---

## 11. Проверка `clearAuth` (auth/store.ts)

При падении `authStatus()` в bootstrap вызывается `clearAuth()`. Важно, чтобы `status` не оставался `"unknown"`, иначе `authReady` застрянет в `false` и UI покажет вечную «Завантаження…».

**Проверено:** `clearAuth()` устанавливает `authStore.status = "anonymous"` (стр. 65), а не `"unknown"`. Крайний случай не возникает.

---

## 12. Сводка по документации

| Документ | Актуальность |
|----------|--------------|
| `AUTHENTICATION_FRONTEND.md` | Описывает текущую архитектуру. |
| `USER_DATA_FLOW.md` | Описывает текущий поток данных (store, subscribeAuth, bootstrap). |

---

## Примечание

Если в твоей локальной версии `Profile.tsx` отсутствуют `validateAvatarMagicBytes`, `parseBalance` или `BalanceHistoryItem` — проверь, что файл сохранён и ты в правильной ветке. В текущем репозитории эти изменения присутствуют (строки 40–66, 71–75, 126, 242, 293, 345).
