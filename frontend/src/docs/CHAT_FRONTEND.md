# Чат на Frontend (`/chat`)

Документ описує фактичну реалізацію чату: файли, потоки даних, WS і store.

---

## 1) Де лежить код

### Основна фіча

`frontend/src/chat/`

- `Chat.tsx` — реекспорт сторінки (`export { default } from "./ChatPage"`).
- `ChatPage.tsx` — оркестрація: auth-gейт, `fetchChats`, lifecycle `chatWs`, модалка створення чату, `visibilitychange` → повторне `fetchChats`; опційно `useQuery` профілю з **`profileQueryKey(userId)`** (`shared/queryKeys.ts`).
- `Chat.module.css` — стилі сторінки та локальних модалок (у т.ч. `.unreadBadge` у списку чатів).

### Компоненти

- `components/ChatList.tsx` — лівий стовпчик: список діалогів (з **бейджем `unread_count`** при `> 0`), кнопка «Створити чат».
- `components/ChatWindow.tsx` — вікно вибраного чату: повідомлення, підвантаження старіших (scroll), відправка, підтвердження видалення.
- `components/CreateChatModal.tsx` — модалка: **пошук користувачів** (`searchChatUsers` → `GET .../user-search/`) + створення чату.

### Дані та стан

- `api/types.ts` — `ChatListItem`, `ChatMessage`, `ChatParticipant`, `MessagesPage` (`results`, `next_before`), `ChatUserSearchHit`.
- `api/chatApi.ts` — HTTP до `/api/chat/*`: `getChats`, `getChat`, **`getChatMessagesPage`**, **`searchChatUsers`**, `createChat`, тощо.
- `store/chatStore.ts` — зовнішній store (стан + actions + `subscribe`); курсори **`messagesOlderCursor`** для сторінок повідомлень.
- `store/useChat.ts` — `useSyncExternalStore` над снапшотом store.

### Realtime

- `ws/chatWs.ts` — WebSocket кімнати чату: `/ws/chat/{chatId}/` (**без токена в URL**; auth через cookies / сесію). Підписка **`subscribeConnectionStatus`** (`disconnected` | `connected` | `reconnecting`). Після обриву — **експоненційний backoff** `min(1000 * 2**retryCount, 60_000) ms` + випадковий jitter до 1 с; перед повторним відкриттям сокета викликається **`authStatus()`** — реконнект **не** вимикається на мережевій помилці, лише на **HTTP 401/403** (`isUnrecoverableSessionHttpError` у `shared/utils/errorUtils.ts`).
- `ws/counterWs.ts` — глобальний лічильник: `/ws/counter/`; парсить **`unread_count`** / `unreadCount`; той самий backoff і правила **`authStatus()`**, що й у чат-WS; є **`subscribeConnectionStatus`** (для консистентності з `chatWs`, UI може не підписуватися).

### Інтеграція в додаток

- `src/App.tsx` — маршрут `/chat` (lazy: `import("./chat/Chat")`).
- `src/widgets/header/Header.tsx` — для авторизованого користувача: `chatActions.fetchChats()`, **`counterWs.connect()`**, обробник викликає **`applyCounterEvent(..., unreadCount)`**; періодичний **`fetchChats` кожні 30 с** як fallback; перехід на **`/chat`** по іконці повідомлень (окремо від сторінки сповіщень **`/messages`**).
- `src/api/endpoints.ts` — об’єкт `API.chat` (у т.ч. **`userSearch`**, **`messages`**).

---

## 2) HTTP API, який викликає фронт

`chatApi.ts` + `API.chat`:

- `GET /api/chat/` — список чатів (`getChats`).
- `GET /api/chat/user-search/?q=` — підказки (`searchChatUsers`, мін. 2 символи в запиті).
- `GET /api/chat/{id}/messages/` — сторінка повідомлень: query **`limit`**, **`before`** (`getChatMessagesPage`) → `{ results, next_before }`.
- `POST /api/chat/create/` — створити чат, body: `{ username | user, message? }` (`createChat`). Існуючий діалог з тим самим співрозмовником може повернутися як **200**, а не помилка.
- `GET /api/chat/{id}/` — один чат (`getChat`), наприклад для відновлення після помилок.
- `DELETE /api/chat/{id}/` — видалити чат.
- `POST /api/chat/{id}/mark_as_read/` — позначити прочитаним.
- `POST /api/chat/{id}/send_message/` — fallback-відправка, якщо WS чату не відкритий (`sendMessage`).

Запити йдуть через `api/http.ts` (Bearer + загальний механізм refresh/retry).

---

## 3) Store: що зберігається

`chatStore.ts`:

- `chats`, `messagesByChatId`, `selectedChatId`
- **`messagesOlderCursor`** — `next_before` для підвантаження старіших повідомлень по чату
- `loadingChats`, `loadingMessages`, `error`
- `unreadTotal` — сума `unread_count` по чатах

Важливо:

- **`fetchChats`**: на початку **`if (state.loadingChats) return`** — захист від паралельних HTTP-запитів.
- **`fetchMessages`**: перша сторінка через `getChatMessagesPage(chatId)`; старіші — **`getChatMessagesPage(chatId, { before: cursor })`**.
- **`applyCounterEvent(chatId, message, username, unreadCount?)`**: якщо чату ще нема в store і не йде завантаження — **`fetchChats()`**; якщо з WS прийшов **`unreadCount`** — він перезаписує локальний лічильник (узгоджено з БД); інакше — інкремент через `upsertChatFromMessage`.
- Сортування діалогів за `last_message.created_at`, захист від дублікатів повідомлень за `id`, `recalcUnreadTotalInternal`.

---

## 4) WebSocket

### 4.1 `chatWs` (обраний чат)

Файл: `ws/chatWs.ts`

- Підключення до **`/ws/chat/{chatId}/`** (base з `VITE_WS_BASE_URL` / `VITE_API_BASE_URL` / same-origin у dev).
- **Токен у query не передається** — сесійні cookies.
- Відправка: `sendMessage(text)` → `{"message":"..."}`; **`{"type":"ping"}`** підтримується на бекенді → `pong`.
- **Автореконект** з експоненційним backoff (див. вище), лише якщо розрив стався «випадково», а цільовий чат той самий (`targetChatId` / `activeSocketChatId`); при перемиканні чату або **`disconnect()`** реконект вимикається. Індикатор **`reconnecting`** у статусі з’являється з затримкою (~2,5 с), щоб не миготіти на коротких обривах.
- Закриття з коду **4401** (після logout / `force.disconnect`) — без реконнекту.

У `ChatPage.tsx`: при зміні `selectedChatId` — `connect` / cleanup `disconnect`; вхідні події → `actions.handleIncomingMessage`.

### 4.2 `counterWs` (глобальний)

Файл: `ws/counterWs.ts`

- Підключення до **`/ws/counter/`** (ті самі правила base URL).
- На `onopen` — `{"type":"ping"}`.
- Події з **`unread_count`** передаються в **`applyCounterEvent`** (вхідний JSON від сервера має **`type: "message"`** на рівні клієнтського парсера).
- **Реконект** — той самий backoff і правила `authStatus()`, що в `chatWs`.

У **`Header.tsx`**: підписка для оновлення бейджа **`unreadTotal`**.

---

## 5) Поведінка сторінки `/chat` (`ChatPage.tsx`)

1. `useAuth()`: `authReady`, `isAuthenticated`, `username`, `userId`.
2. Поки `!authReady` — «Завантаження…».
3. Якщо `!isAuthenticated` — `<Navigate to="/login" />`.
4. Після авторизації: **`fetchChats()`**; при **`visibilitychange` → visible** — знову **`fetchChats()`**.
5. `chatWs` підключається до **`selectedChatId`**; у cleanup — `offMessage` + **`disconnect()`**.

---

## 6) Кнопки та дії (фактично)

### «Створити чат» → `CreateChatModal`

- Пошук за підрядком (API `user-search`); submit → `createChat(username, firstMessage?)`. Неоднозначний збіг / валідація — повідомлення з API; дублікат чату обробляється як успіх (200) з наявним діалогом.

### Вибір чату в списку

- `selectChat(chatId)`; у **`ChatList`** для чатів з **`unread_count > 0`** показується **`.unreadBadge`**.
- У `ChatWindow` при ініціалізації чату: **`fetchMessages`** (перша сторінка) + **`markReadLocal` + `markChatAsRead`**; скрол вгору — **`loadOlderMessages`** за `messagesOlderCursor`.

### Відправка повідомлення

- Якщо WS відкритий — `chatWs.sendMessage`; інакше **`sendMessage`** (HTTP). Бекенд у обох випадках оновлює БД і шле події в кімнату чату та counter.

### «Видалити чат»

- Підтвердження → `deleteChat(chatId)`.

---

## 7) «Моє повідомлення» (ліво / право)

`ChatWindow.tsx`: своє, якщо `message.sender.id === userId` або fallback за нормалізованим `username` (WS інколи дає лише username).

---

## 8) Захисти та перевірки

- Store: `selectChat` без зайвого emit; `fetchMessages` / завантаження старіших не дублюються під час завантаження; `markReadLocal` якщо вже 0; дедуп повідомлень за `id`.
- `ChatWindow`: `initializedChatRef` уникає повторних load/read для того ж `chatId`.
- `CreateChatModal`: submit залежить від валідного вибору користувача / полів (див. код).

---

## 9) Нюанси

- У dev можливе попередження браузера про закриття WebSocket до завершення handshake при швидких mount/unmount — зазвичай не критично.
- Бекенд тримає **`last_message`** на моделі `Chat`; порядок полів у `ChatSerializer` не вимагає prefetch усіх повідомлень для прев’ю.

---

## 10) Пов’язана документація

- `frontend/src/docs/USER_DATA_FLOW.md` — чат і header у контексті auth.
- `backend/docs/CHAT_BACKEND.md` — моделі, REST, pagination, consumers, `message_service`, throttling, `user-search`.

---

**Останнє оновлення:** пагінація повідомлень, `user-search`, backoff реконнекту, `authStatus` / 401–403, `profileQueryKey`, payload counter `type: "message"`.
