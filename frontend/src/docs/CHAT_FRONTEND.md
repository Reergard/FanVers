# Чат на Frontend (`/chat`)

Документ описує фактичну реалізацію чату: файли, потоки даних, WS і store.

---

## 1) Де лежить код

### Основна фіча

`frontend/src/chat/`

- `Chat.tsx` — реекспорт сторінки (`export { default } from "./ChatPage"`).
- `ChatPage.tsx` — оркестрація: auth-gейт, `fetchChats`, lifecycle `chatWs`, модалка створення чату, `visibilitychange` → повторне `fetchChats`.
- `Chat.module.css` — стилі сторінки та локальних модалок (у т.ч. `.unreadBadge` у списку чатів).

### Компоненти

- `components/ChatList.tsx` — лівий стовпчик: список діалогів (з **бейджем `unread_count`** при `> 0`), кнопка «Створити чат».
- `components/ChatWindow.tsx` — вікно вибраного чату: повідомлення, відправка, підтвердження видалення.
- `components/CreateChatModal.tsx` — модалка створення (`shared/Modal/Modal`).

### Дані та стан

- `api/types.ts` — `ChatListItem`, `ChatMessage`, `ChatParticipant` (у списку є **`unread_count?`**).
- `api/chatApi.ts` — HTTP до `/api/chat/*` через `http.ts`.
- `store/chatStore.ts` — зовнішній store (стан + actions + `subscribe`).
- `store/useChat.ts` — `useSyncExternalStore` над снапшотом store.

### Realtime

- `ws/chatWs.ts` — WebSocket кімнати чату: `/ws/chat/{chatId}/` (**без токена в URL**; auth через cookies / сесію, як і на бекенді).
- `ws/counterWs.ts` — глобальний лічильник: `/ws/counter/`; парсить **`unread_count`** / `unreadCount`; **автореконект** через ~3 с після обриву.

### Інтеграція в додаток

- `src/App.tsx` — маршрут `/chat` (lazy: `import("./chat/Chat")`).
- `src/widgets/header/Header.tsx` — для авторизованого користувача: `chatActions.fetchChats()`, **`counterWs.connect()`**, обробник викликає **`applyCounterEvent(..., unreadCount)`**; періодичний **`fetchChats` кожні 30 с** як fallback; перехід на **`/chat`** по іконці повідомлень (окремо від сторінки сповіщень **`/messages`**).
- `src/api/endpoints.ts` — об’єкт `API.chat`.

---

## 2) HTTP API, який викликає фронт

`chatApi.ts` + `API.chat`:

- `GET /api/chat/` — список чатів (`getChats`).
- `GET /api/chat/{id}/messages/` — повідомлення (`getChatMessages`).
- `POST /api/chat/create/` — створити чат, body: `{ username, message? }`.
- `DELETE /api/chat/{id}/` — видалити чат.
- `POST /api/chat/{id}/mark_as_read/` — позначити прочитаним.
- `POST /api/chat/{id}/send_message/` — fallback-відправка, якщо WS чату не відкритий (`sendMessage`).

Запити йдуть через `api/http.ts` (Bearer + загальний механізм refresh/retry).

---

## 3) Store: що зберігається

`chatStore.ts`:

- `chats`, `messagesByChatId`, `selectedChatId`
- `loadingChats`, `loadingMessages`, `error`
- `unreadTotal` — сума `unread_count` по чатах

Важливо:

- **`fetchChats`**: на початку **`if (state.loadingChats) return`** — захист від паралельних HTTP-запитів.
- **`applyCounterEvent(chatId, message, username, unreadCount?)`**: якщо чату ще нема в store і не йде завантаження — **`fetchChats()`**; якщо з WS прийшов **`unreadCount`** — він перезаписує локальний лічильник (узгоджено з БД); інакше — інкремент через `upsertChatFromMessage`.
- Сортування діалогів за `last_message.created_at`, захист від дублікатів повідомлень за `id`, `recalcUnreadTotalInternal`.

---

## 4) WebSocket

### 4.1 `chatWs` (обраний чат)

Файл: `ws/chatWs.ts`

- Підключення до **`/ws/chat/{chatId}/`** (base з `VITE_WS_BASE_URL` / `VITE_API_BASE_URL` / same-origin у dev).
- **Токен у query не передається** — сесійні cookies.
- Відправка: `sendMessage(text)` → `{"message":"..."}`.
- **Автореконект** (~3 с) лише якщо розрив стався «випадково», а цільовий чат той самий (`targetChatId` / `activeSocketChatId`); при перемиканні чату або **`disconnect()`** реконект вимикається.

У `ChatPage.tsx`: при зміні `selectedChatId` — `connect` / cleanup `disconnect`; вхідні події → `actions.handleIncomingMessage`.

### 4.2 `counterWs` (глобальний)

Файл: `ws/counterWs.ts`

- Підключення до **`/ws/counter/`** (ті самі правила base URL).
- На `onopen` — `{"type":"ping"}`.
- Події з **`unread_count`** передаються в **`applyCounterEvent`**.
- **Реконект** після обриву (~3 с), доки не викликано **`disconnect()`**.

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

- Submit → `createChat(username, firstMessage?)`; дублікат чату → `showWarning`; інакше помилка → `showError`.

### Вибір чату в списку

- `selectChat(chatId)`; у **`ChatList`** для чатів з **`unread_count > 0`** показується **`.unreadBadge`**.
- У `ChatWindow` при ініціалізації чату: завантаження повідомлень + **`markReadLocal` + `markChatAsRead`**.

### Відправка повідомлення

- Якщо WS відкритий — `chatWs.sendMessage`; інакше **`sendMessageFallback`** (HTTP). Бекенд у обох випадках шле події в кімнату чату та counter — співрозмовник бачить оновлення в реальному часі.

### «Видалити чат»

- Підтвердження → `deleteChat(chatId)`.

---

## 7) «Моє повідомлення» (ліво / право)

`ChatWindow.tsx`: своє, якщо `message.sender.id === userId` або fallback за нормалізованим `username` (WS інколи дає лише username).

---

## 8) Захисти та перевірки

- Store: `selectChat` без зайвого emit; `fetchMessages` не дублюється під час завантаження; `markReadLocal` якщо вже 0; дедуп повідомлень за `id`.
- `ChatWindow`: `initializedChatRef` уникає повторних load/read для того ж `chatId`.
- `CreateChatModal`: submit disabled при порожньому username.

---

## 9) Нюанси

- У dev можливе попередження браузера про закриття WebSocket до завершення handshake при швидких mount/unmount — зазвичай не критично.
- Якщо **лише** змінити порядок полів у `ChatSerializer` так, що **`unread_count` обчислюється раніше за `last_message`**, на бекенді можливе зайве навантаження на prefetch повідомлень; на фронті це не налаштовується.

---

## 10) Пов’язана документація

- `frontend/src/docs/USER_DATA_FLOW.md` — чат і header у контексті auth.
- `backend/docs/CHAT_BACKEND.md` — моделі, REST, consumers, counter payload.
