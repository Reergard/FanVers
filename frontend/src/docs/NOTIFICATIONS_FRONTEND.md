# Уведомлення на Frontend

Цей документ описує, як працює система **внутрішніх повідомлень** (список на `/messages`): файли, потік даних, кеш React Query, API та відмінність від **toast** у `NotificationProvider`.

Повна картина бекенду (версії, права, сигнали): **`backend/docs/NOTIFICATIONS_BACKEND.md`**.

---

## 1. Огляд

Сторінка **`/messages`** (`NotificationsPage`) дозволяє:

- переглядати список повідомлень з API;
- позначати як прочитані та видаляти;
- для записів з репортом помилки — відкрити модалку з деталями (див. **`BOOK_ERROR_REPORT_FRONTEND.md`**);
- зберігати **налаштування типів** повідомлень у профілі (чекбокси; це не фільтр поточного списку на клієнті).

Дані — REST через `api/http.ts` (JWT). Кеш і мутації — **React Query**. Той самий запит списку використовується в **шапці** для лічильника непрочитаних.

---

## 2. Файли та відповідальність

### 2.1. Структура

```
frontend/src/
├── api/
│   ├── endpoints.ts          # URL повідомлень та профілю
│   └── http.ts               # Axios + інтерцептори
├── notification/
│   ├── types.ts
│   ├── notificationsService.ts
│   ├── useNotifications.ts
│   ├── NotificationsPage.tsx
│   ├── NotificationsPage.module.css
│   └── parseErrorReportSuggestion.ts   # розбір suggestion для модалки репорту
├── users/
│   ├── profileService.ts
│   └── types.ts
├── shared/
│   └── queryKeys.ts          # profileQueryKey(userId) для інвалідації кешу профілю після зміни налаштувань сповіщень
├── widgets/header/
│   └── Header.tsx            # useNotifications → бейдж непрочитаних
└── shared/NotificationModal/
    ├── NotificationProvider.tsx
    ├── NotificationModal.tsx
    └── AutoCloseNotificationModal.tsx
```

### 2.2. Таблиця файлів

| Файл | Відповідальність |
|------|------------------|
| **api/endpoints.ts** | `notifications`, `notificationById(id)`, `notificationMarkAsRead(id)`; налаштування: `profileNotificationSettings`. |
| **api/http.ts** | `Authorization: Bearer`, 401 → refresh → один retry; CSRF тощо. |
| **notification/types.ts** | `AppNotification`; `NotificationsResponse` — масив (legacy) або `{ notifications, version? }`. |
| **notification/notificationsService.ts** | `getNotifications`, `markNotificationAsRead`, `deleteNotification`, **`getNotificationById`** (GET одного запису для повних полів репорту). Нормалізація snake_case/camelCase, дедуп по `id`. |
| **notification/useNotifications.ts** | `useQuery` + merge, якщо відповідь має порожній `notifications`, а в кеші вже був непорожній список (узгоджено з контрактом бекенда «без змін»); мутації оновлюють кеш без повного refetch. |
| **notification/NotificationsPage.tsx** | UI сторінки, фільтри профілю, локальне «Показати ще», pending **по id** на кнопках. |
| **widgets/header/Header.tsx** | `useNotifications(isAuthenticated)`; `unreadNotificationsCount` = кількість елементів з `!is_read` у кеші. |
| **users/profileService.ts** | `updateNotificationSettings` → PUT на `profileNotificationSettings`. |
| **users/types.ts** | `NotificationSettingsPatch` тощо. |
| **shared/NotificationModal/NotificationProvider.tsx** | Toast: `showSuccess`, `showError`, `showSuccessAutoClose` тощо — **не** список `/messages`. |

---

## 3. Маршрутизація та вхід

- **Шлях:** `/messages`
- **Компонент:** `NotificationsPage` — lazy у `App.tsx` (`React.lazy`).

Порядок:

1. `useAuth()` → `authReady`, `isAuthenticated`.
2. `!authReady` — «Завантаження…».
3. `!isAuthenticated` — заклик увійти; **`openLoginModal("/messages")`** (модалка входу з поверненням на `/messages`), а не окремий лінк лише на `/login`.
4. Інакше — контент сторінки та запити з `enabled: isAuthenticated`.

---

## 4. Отримання списку

### 4.1. Ланцюжок

1. Сторінка та `Header` викликають **`useNotifications(isAuthenticated)`** → `useQuery` з `enabled: isAuthenticated`.
2. **`queryFn`**:
   - читає попередній кеш `qc.getQueryData(["notifications"])`;
   - викликає `getNotifications({ version: prev?.version ?? null })`.
3. **`getNotifications`** (`notificationsService.ts`):
   - `GET API.notifications` з **`Cache-Control: no-cache`**;
   - query-параметр **`version` додається лише якщо значення truthy** (`params?.version ? { version } : undefined`) — перший запит іде **без** `version`; якщо збережене `version` дорівнює **`0`** (число), воно теж не потрапить у query (falsy), бекенд використає дефолт **`'0'`**;
   - після відповіді — нормалізація та дедуп по `id`.
4. **Злиття з кешем (важливо):** бекенд при **збігу версій** повертає порожній масив (див. бекенд-док). У `queryFn` умова в коді саме така: **`result.notifications.length === 0` і `prev.notifications` непорожній** — тоді повертається **`{ notifications: prev.notifications, version: result.version }`**. Явного порівняння `version` у TypeScript немає: коректність забезпечує контракт API (порожній список лише в сценарії «нічого не змінилось»). Інакше повертається `result`.

### 4.2. Формати відповіді бекенду

- Основний: `{ notifications: [...], version }` (`version` у JSON часто **число**, на клієнті зберігається як прийшло).
- Legacy: масив напряму — `normalizeNotifications` приводить до єдиної форми.

### 4.3. React Query

- `queryKey`: **`["notifications"]`** — спільний для сторінки та шапки.
- `staleTime: 20_000` мс.
- `refetchOnWindowFocus: true`.

---

## 5. Авторизація та безпека

- Поки **`isAuthenticated === false`**, запит списку **не виконується** (`enabled: false`).
- Бекенд для `/api/notification/notifications/` вимагає **JWT** та **`IsAuthenticated`**; при простроченому токені спрацьовує ланцюжок refresh у `http.ts`.

---

## 6. Стани UI

### 6.1. Умовний рендеринг (`NotificationsPage`)

| Умова | Екран |
|--------|--------|
| `!authReady` | Завантаження |
| `!isAuthenticated` | Потрібен вхід (модалка) |
| `isError` | Помилка + «Спробувати ще раз» (`refetch`) |
| `isLoading` | Завантаження списку |
| `notifications.length === 0` | Порожній стан |
| Є дані | Список |

### 6.2. Картка повідомлення

- Заголовок «Повідомлення N», крапка якщо `!is_read`.
- Текст `message`, дата `created_at` (uk-UA).
- **«Позначити як прочитане»** — `disabled`, коли **для цього** `id` йде мутація (`pendingMarkReadId === m.id`).
- **«Видалити»** — `disabled`, коли `pendingDeleteId === m.id`.

### 6.3. «Показати ще»

- **`PAGE_SIZE = 10`** (порція на екран).
- `visibleNotifications = notifications.slice(0, visibleCount)`.
- `ShowMoreNavigation`; при зміні **`notifications.length`** скидається `visibleCount` до `PAGE_SIZE`.

Деталі патерну — **`PAGINATION_SHOW_MORE_FRONTEND.md`**.

---

## 7. Мутації

### 7.1. Прочитано

`handleMarkAsRead` → `setPendingMarkReadId(id)` → `markRead.mutate(id, { onSettled: () => setPendingMarkReadId(null) })`.

- HTTP: **`PATCH`** `API.notificationMarkAsRead(id)`.
- `onSuccess` у хуку: у кеші оновлюється `is_read: true` для відповідного `id`.

### 7.2. Видалити

`handleDelete` → аналогічно з `pendingDeleteId`, плюс `showSuccess` / `showError` у колбеках мутації на сторінці.

- HTTP: **`DELETE`** `API.notificationById(id)`.
- `onSuccess` у хуку: елемент прибирається з масиву в кеші.

### 7.3. Деталі репорту в модалці

Після вибору повідомлення в `activeReport`: якщо **`error_report_id` відсутній** — у модалці використовується лише об’єкт зі списку. Якщо **`error_report_id` є** — виконується **`getNotificationById(activeReport.id)`** (GET одного ресурсу); при помилці запиту показуються дані зі списку як запасний варіант.

---

## 8. Фільтри (налаштування в профілі)

Не фільтрують список на клієнті: зберігаються на сервері через **`updateNotificationSettings`** → **PUT** `API.profileNotificationSettings`.

Поля `NOTIFICATION_FILTERS` / ключі `NotificationSettingsPatch` без змін (див. код `NotificationsPage.tsx`).

Після збереження: `invalidateQueries({ queryKey: profileQueryKey(userId) })` — див. `shared/queryKeys.ts` (`PROFILE_QUERY_ROOT` + id користувача; спільний ключ із `Profile.tsx`, `Header.tsx` тощо).

---

## 9. API Endpoints (фронт)

| Ключ | URL | Метод | Призначення |
|------|-----|-------|-------------|
| `API.notifications` | `/api/notification/notifications/` | GET | Список; query `version` — лише коли передано непорожнє значення. |
| `API.notificationById(id)` | `/api/notification/notifications/{id}/` | GET | Один запис (деталі для модалки). |
| `API.notificationById(id)` | той самий шлях | DELETE | Видалення. |
| `API.notificationMarkAsRead(id)` | `.../{id}/mark_as_read/` | PATCH | Прочитано. |
| `API.profileNotificationSettings` | `/api/users/profile/notification-settings/` | PUT | Налаштування типів повідомлень. |

---

## 10. Нюанси

### 10.1. Версіонування

- Бекенд при **рівних** client `version` і server `new_version` відповідає **`notifications: []`** і **`version`** (див. `NOTIFICATIONS_BACKEND.md`).
- Клієнт при цьому **не очищує** кеш (див. п. 4.1); без merge порожня відповідь замінила б список у React Query і спорожнила б UI.

### 10.2. Pending по id

- Глобальні `markRead.isPending` / `remove.isPending` на сторінці **не** використовуються для disabled усіх кнопок; блокується лише рядок, по якому пішов запит.

### 10.3. Спільний кеш і шапка

- `Header` і `NotificationsPage` ділять **`["notifications"]`**: оновлення на сторінці одразу відображаються на бейджі непрочитаних.

### 10.4. NotificationProvider vs повідомлення в системі

- **NotificationProvider** — модальні toast (успіх/помилка/…).
- **Повідомлення `/messages`** — окрема сутність з API.

### 10.5. Дедуплікація в сервісі

- Після нормалізації список проходить через `Map` по `id`.

### 10.6. Інші екрани (довідково)

Глобальні модалки успіху/помилки — це **`NotificationProvider`** (toast), не список `/messages`. Рейтинги, коментарі, репорти, створення розділу: див. **`RATINGS_FRONTEND.md`**, **`BOOK_ERROR_REPORT_FRONTEND.md`**, **`ADD_CHAPTER_FLOW.md`** та відповідний код (`BookDetailRouter`, `NotificationProvider`).

---

## 11. Діаграма потоку

```
NotificationsPage.tsx          Header.tsx
       │                            │
       └──── useNotifications(isAuthenticated)
                      │
                      ▼
              useQuery(["notifications"])
                      │
                      ▼
         notificationsService.getNotifications
                      │
                      ▼
                 api/http.ts  ──►  GET /api/notification/notifications/
                      │              (опційно ?version=)
                      ▼
         merge у queryFn, якщо [] + у кеші вже був непорожній список (контракт з бекендом)
```

---

**Останнє оновлення:** узгоджено з `useNotifications.ts` (merge), `NotificationsPage.tsx` (PAGE_SIZE 10, pending по id, інвалідація **`profileQueryKey(userId)`**), `Header.tsx` (бейдж), `notificationsService.ts` (умовний `version`), **`shared/queryKeys.ts`**, **`backend/docs/NOTIFICATIONS_BACKEND.md`** (`IsNotificationOwner`).
