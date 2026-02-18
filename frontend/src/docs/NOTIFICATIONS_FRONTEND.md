# Уведомлення на Frontend

Цей документ описує, як працює система уведомлень на фронтенді: які файли залучені, їх відповідальність, послідовність виконання, логіка та нюанси.

---

## 1. Огляд

Сторінка уведомлень (`/messages`) дозволяє користувачу:

- переглядати список повідомлень, отриманих від системи;
- позначати повідомлення як прочитані;
- видаляти повідомлення;
- налаштовувати типи уведомлень, які потрібно отримувати (через профіль).

Дані беруться з REST API через axios-клієнт `http.ts`. Авторизація — JWT Bearer. React Query керує кешем та мутаціями.

---

## 2. Файли та їх відповідальність

### 2.1. Слотова структура

```
frontend/src/
├── api/
│   ├── endpoints.ts          # URL-и для API уведомлень
│   └── http.ts               # Axios-клієнт з інтерцепторами
├── notification/
│   ├── types.ts              # Типи AppNotification, NotificationsResponse
│   ├── notificationsService.ts # API-функції (get, mark_read, delete)
│   ├── useNotifications.ts    # React Query-хук для сторінки
│   ├── NotificationsPage.tsx # UI-компонент сторінки
│   └── NotificationsPage.module.css
├── users/
│   ├── profileService.ts     # updateNotificationSettings()
│   └── types.ts              # NotificationSettingsPatch, UserProfile
└── shared/
    └── NotificationModal/
        └── NotificationProvider.tsx  # Глобальні toast (showSuccess, showError)
```

### 2.2. Детальний опис файлів

| Файл | Відповідальність |
|------|------------------|
| **api/endpoints.ts** | Зберігає URL-и для уведомлень: `notifications`, `notificationById(id)`, `notificationMarkAsRead(id)`. Єдине місце визначення шляхів. |
| **api/http.ts** | Axios-інстанція з інтерцепторами: підставляє `Authorization: Bearer`, при 401 викликає refresh, один retry, при невдалій спробі — logout. Всі запити уведомлень йдуть через цей клієнт. |
| **notification/types.ts** | `AppNotification` — модель одного повідомлення (id, message, is_read, created_at, опційно error_report_id, book_title тощо). `NotificationsResponse` — union типу для двох форматів відповіді: масив або `{ notifications, version }`. |
| **notification/notificationsService.ts** | Чистий API-шар: `getNotifications()`, `markNotificationAsRead()`, `deleteNotification()`. Нормалізує відповідь з бекенду, робить дедуплікацію по id. |
| **notification/useNotifications.ts** | React Query-хук: `useQuery` для завантаження, `useMutation` для mark_read і delete. Оновлює кеш без refetch після мутацій. |
| **notification/NotificationsPage.tsx** | UI-компонент: гейти по auth, рендер списку, обробники кліків, фільтри з профілю, збереження налаштувань. |
| **users/profileService.ts** | `updateNotificationSettings(patch)` — PUT на `/api/users/profile/notification-settings/`. Використовується для збереження чекбоксів фільтрів. |
| **users/types.ts** | `NotificationSettingsPatch` — частковий тип з полями `comment_notifications`, `translation_status_notifications` тощо. |
| **shared/NotificationModal/NotificationProvider.tsx** | Глобальний контекст для toast: `showSuccess`, `showError`, `showInfo`, `showWarning`, **`showSuccessAutoClose(message)`** (модалка без кнопок, авто-закриття через 3 с). Рендерить NotificationModal або AutoCloseNotificationModal залежно від variant. Використовується для зворотного зв’язку після збереження/видалення та після створення глави. |
| **shared/NotificationModal/AutoCloseNotificationModal.tsx** | Модалка успіху без кнопок: тільки заголовок «Успіх» і текст; закривається по таймеру (prop `autoCloseMs`). Використовується для повідомлення після створення глави. |

---

## 3. Маршрутизація та вхід на сторінку

- **Шлях:** `/messages`
- **Компонент:** `NotificationsPage` (lazy-завантаження через `React.lazy`)
- **Опис:** `App.tsx` містить `<Route path="/messages" element={<NotificationsPage />} />`

При переході на `/messages`:

1. Змонтується `NotificationsPage`.
2. Викликається `useAuth()` → перевірка `authReady` і `isAuthenticated`.
3. Якщо `!authReady` — показується «Завантаження…».
4. Якщо `!isAuthenticated` — показується блок з посиланням на `/login`.
5. Якщо `isAuthenticated` — рендериться повний контент і запускаються запити.

---

## 4. Отримання даних уведомлень

### 4.1. Послідовність

1. **NotificationsPage** викликає `useNotifications(isAuthenticated)`.
2. **useNotifications** створює `useQuery` з `enabled: isAuthenticated`:
   - Запит не виконується, доки `isAuthenticated === false`.
3. **queryFn**:
   - Бере з кешу попередні дані (`qc.getQueryData(KEY)`).
   - Передає `version` у `getNotifications({ version })` (для оптимізації на бекенді).
4. **notificationsService.getNotifications()**:
   - Робить `http.get(API.notifications, { params: { version }, headers: { "Cache-Control": "no-cache" } })`.
   - `http` додає `Authorization: Bearer <access>`.
   - Бекенд повертає `{ notifications: [...], version }` або масив (legacy).
5. **normalizeNotifications(res.data)**:
   - Якщо `Array.isArray(data)` → `{ items: [...], version: "0" }`.
   - Якщо `data.notifications` → `{ items: data.notifications, version: data.version }`.
   - Фільтрує елементи без `id`.
6. **Дедуплікація:** `[...new Map(items.map(n => [n.id, n])).values()]`.
7. Повертається `{ notifications, version }` і зберігається в React Query-кеші за ключем `["notifications"]`.

### 4.2. Формати відповіді бекенду

- **Новий формат:** `{ notifications: AppNotification[], version?: string }`
- **Legacy-формат:** `AppNotification[]` (масив напряму)

`normalizeNotifications` коректно обробляє обидва варіанти.

### 4.3. Параметри React Query

- `staleTime: 20_000` — дані вважаються свіжими 20 секунд.
- `refetchOnWindowFocus: true` — при поверненні на вкладку список оновлюється.

---

## 5. Авторизація та безпека

### 5.1. Гейти на сторінці

- **authReady** — bootstrap завершено, статус не `unknown`.
- **isAuthenticated** — `status === "authenticated"` в auth store.

`useNotifications(isAuthenticated)` передає в `useQuery` параметр `enabled: isAuthenticated`. Тому **API-запити уведомлень не відправляються, доки `isAuthenticated === false`**. Параметр `authReady` не впливає на `enabled` — він лише контролює ранній return («Завантаження…»), коли bootstrap ще не завершено (у цей момент зазвичай `isAuthenticated` теж false).

### 5.2. Інтерцептори http.ts

- **Request:** підставляється `Authorization: Bearer <access>`.
- **Response 401:** викликається `refreshSessionForce()`, один retry оригінального запиту.
- **Якщо retry невдалий:** `doLogout()`, помилка пробрасывается далі.

Для неавторизованих користувачів запити не йдуть, тому 401 від уведомлень не виникає.

---

## 6. Стани UI та відображення

### 6.1. Умовний рендеринг

| Умова | Відображення |
|-------|---------------|
| `!authReady` | «Завантаження…» |
| `!isAuthenticated` | Блок «Увійти» з посиланням на `/login` |
| `isError` | Повідомлення про помилку + кнопка «Спробувати ще раз» |
| `isLoading` | «Завантаження повідомлень…» |
| `notifications.length === 0` | «Немає повідомлень» |
| Є дані | Список уведомлень |

### 6.2. Структура картки уведомлення

- **Заголовок:** «Повідомлення N» + індикатор (крапка), якщо `!is_read`.
- **Текст:** `message` або «Немає тексту повідомлення».
- **Дата:** `created_at` у форматі uk-UA.
- **Дії:**
  - «Позначити як прочитане» — тільки для непрочитаних, при `markRead.isPending` кнопка disabled.
  - «Видалити» — при `remove.isPending` disabled.

---

## 7. Дії з уведомленнями

### 7.1. Позначити як прочитане

1. Клік по кнопці → `handleMarkAsRead(m.id)` → `markRead.mutate(id)`.
2. **useNotifications.markRead**:
   - `mutationFn: markNotificationAsRead` → `http.patch(API.notificationMarkAsRead(id))`.
   - `onSuccess`: оновлює кеш: елемент з `id` отримує `is_read: true`.
3. UI оновлюється без refetch.

### 7.2. Видалити

1. Клік → `handleDelete(m.id)` → `remove.mutate(id, { onSuccess, onError })`.
2. **useNotifications.remove**:
   - `mutationFn: deleteNotification` → `http.delete(API.notificationById(id))`.
   - `onSuccess`: елемент з `id` видаляється з кешу.
3. Викликається `showSuccess("Повідомлення видалено")` або `showError(...)` при помилці.

### 7.3. Спробувати ще раз (після помилки)

- `refetch()` — примусове повторне завантаження списку.

---

## 8. Фільтри (налаштування уведомлень)

### 8.1. Призначення

Фільтри — це не клієнтський фільтр списку, а налаштування типу уведомлень, які користувач хоче отримувати. Вони зберігаються на сервері в профілі.

### 8.2. Поля з профілю

`NOTIFICATION_FILTERS` мапляться на `NotificationSettingsPatch`:

| key | label |
|-----|-------|
| `comment_notifications` | Коментарі у ваших постах та відповіді на ваші коментарі |
| `translation_status_notifications` | Зміна статусу перекладу |
| `chapter_subscription_notifications` | Зняття розділу з передплати |
| `chapter_comment_notifications` | Коментарі до розділу |

### 8.3. Завантаження початкових значень

1. `profileQuery` з `queryKey: ["profile"]`, `queryFn: getMyProfile`, `enabled: isAuthenticated`.
2. Після приходу `profile` — `useEffect` заповнює `filters` з `profile[key]`.
3. Якщо `profile[key]` не boolean — береться `true`.

### 8.4. Зміна чекбоксів

- `handleFilterChange(key, checked)` → `setFilters(prev => ({ ...prev, [key]: checked }))`.
- Тип: `Partial<Record<keyof NotificationSettingsPatch, boolean>>` — захист від збереження зайвих ключів.

### 8.5. Збереження

1. Клік «Зберегти» → `handleSaveFilters()`.
2. Будується `patch`: тільки ключі з `NOTIFICATION_FILTERS`, значення перевіряються на `typeof === "boolean"`.
3. `saveFiltersMutation.mutate(patch)` → `updateNotificationSettings(patch)` → у `profileService` використовується `http.put(API.profileNotificationSettings, patch)`.
4. `onSuccess`: `invalidateQueries(["profile"])`, `showSuccess("Налаштування збережено")`.
5. `onError`: `showError(msg ?? "Помилка при збереженні")`.

### 8.6. Блокування кнопки «Зберегти»

- `profileLoaded = !profileQuery.isLoading && !!profile`.
- `canSaveFilters = profileLoaded && Object.keys(filters).length > 0`.
- Кнопка disabled, якщо `!canSaveFilters || saveFiltersMutation.isPending`.

Це не дає зберегти порожній patch до завантаження профілю.

---

## 9. API Endpoints

| Ключ | URL | Метод | Призначення |
|------|-----|-------|-------------|
| `API.notifications` | `/api/notification/notifications/` | GET | Список уведомлень. Query: `version` (опційно). |
| `API.notificationById(id)` | `/api/notification/notifications/{id}/` | DELETE | Видалення уведомлення. |
| `API.notificationMarkAsRead(id)` | `/api/notification/notifications/{id}/mark_as_read/` | PATCH | Позначити як прочитане. |
| `API.profileNotificationSettings` | `/api/users/profile/notification-settings/` | PUT | Збереження налаштувань уведомлень (через users). |

---

## 10. Нюанси та обмеження

### 10.1. Versioning

- Кеш React Query зберігає `version` з попередньої відповіді.
- При наступному запиті `version` передається на бекенд.
- Бекенд може повертати порожній список, якщо нічого не змінилося (зменшення трафіку).

### 10.2. isPending на кнопках

- `markRead.isPending` і `remove.isPending` — глобальні: при будь-якій мутації блокуються всі відповідні кнопки.
- Немає «pending per id» — поки йде одна операція, блокуються всі кнопки mark-read і delete.

### 10.3. Спільний кеш із профілем

- `profileQuery` використовує `["profile"]`.
- Після `updateNotificationSettings` викликається `invalidateQueries(["profile"])`.
- Інші екрани (наприклад, Profile), що використовують той самий ключ, отримають оновлені дані.

### 10.4. NotificationProvider vs повідомлення в системі

- **NotificationProvider** — глобальні toast (success, error, info, warning).
- **Уведомлення в системі** — список повідомлень із бекенду (коментарі, передплати тощо).
- Це різні сутності; вони спільні тільки в назві.

**Коментарі (catalog):** секція коментарів використовує тільки **showError** з `useNotification()` — для помилок завантаження списку, помилок 403 при відправці/видаленні та загальних помилок API. Success-повідомлення після відправки коментаря, відповіді або видалення не показуються.

**Рейтинги (catalog):** компонент `BookRatingStars` використовує `useNotification()`: **showWarning** — коли неавторизований користувач клікає по зірці («Для голосування необхідно увійти в систему»); **showError** — при помилці відправки оцінки (в т.ч. 429, або текст з `data.error` / `data.detail` з відповіді сервера). Детально: RATINGS_FRONTEND.md.

### 10.5. Глобальні toast (NotificationProvider) — два варіанти

**Файли:** `shared/NotificationModal/NotificationProvider.tsx`, `NotificationModal.tsx`, `AutoCloseNotificationModal.tsx`, `Modal/Modal.tsx`.

- Провайдер зберігає state: `open`, `message`, `type`, **variant** (`"default"` | `"autoClose"`).
- **variant "default"**: рендериться `NotificationModal` — заголовок за типом, текст, кнопка «Зрозуміло», у Modal показується кнопка ×. Закриття: клік по overlay, ×, «Зрозуміло», Escape.
- **variant "autoClose"**: рендериться `AutoCloseNotificationModal` — заголовок «Успіх», тільки текст повідомлення, **без кнопок** (Modal з `showCloseButton={false}`). Закриття **автоматично** через `AUTO_CLOSE_MS` (3000 мс) по таймеру в useEffect; overlay-клік і Escape також викликають `onClose`.
- Метод **showSuccessAutoClose(message)** встановлює variant `"autoClose"` і відкриває модалку. Використовується в `catalog/BookDetailRouter.tsx`: після редиректу з сторінки додавання глави перевіряється `location.state?.chapterCreated`; якщо true — викликається `showSuccessAutoClose("Глава успішно завантажена")`, потім state очищається (navigate replace), щоб при оновленні сторінки модалка не показувалась знову.

### 10.5. Дедуплікація

- У `notificationsService` застосовується `Map` по `id`, щоб уникнути дублікатів у списку.

---

## 11. Діаграма потоку даних

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NotificationsPage.tsx                             │
├─────────────────────────────────────────────────────────────────────────┤
│  useAuth() ──► authReady, isAuthenticated                                │
│  useNotifications(isAuthenticated) ──► query, markRead, remove             │
│  profileQuery (getMyProfile) ──► profile                                 │
│  useNotification() ──► showSuccess, showError                            │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│   useAuth        │  │ useNotifications │  │ profileQuery                 │
│   (auth/store)   │  │ useQuery(KEY)     │  │ useQuery(["profile"])        │
│                  │  │ useMutation       │  │ getMyProfile()               │
└─────────────────┘  └────────┬──────────┘  └──────────────┬──────────────┘
                              │                             │
                              ▼                             ▼
                    ┌──────────────────┐          ┌──────────────────────┐
                    │ notifications    │          │ profileService        │
                    │ Service          │          │ updateNotification    │
                    │ getNotifications │          │ Settings()            │
                    │ markAsRead       │          └──────────┬───────────┘
                    │ delete           │                     │
                    └────────┬─────────┘                     │
                             │                              │
                             ▼                              ▼
                    ┌──────────────────────────────────────────────────────┐
                    │              api/http.ts (axios)                       │
                    │  Authorization: Bearer / 401 → refresh → retry       │
                    └────────────────────────┬─────────────────────────────┘
                                             │
                                             ▼
                    ┌──────────────────────────────────────────────────────┐
                    │           Backend API                                  │
                    │  /api/notification/notifications/                    │
                    │  /api/users/profile/notification-settings/             │
                    └──────────────────────────────────────────────────────┘
```

---

**Останнє оновлення:** з урахуванням showSuccessAutoClose та AutoCloseNotificationModal (створення глави).
