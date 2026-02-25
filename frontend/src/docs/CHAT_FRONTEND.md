# Чат на Frontend (`/chat`)

Документ описывает реальную реализацию чата во фронтенде: какие файлы участвуют, как идут данные, как работают кнопки и проверки.

---

## 1) Где находится код

### Основная фича

`frontend/src/chat/`

- `Chat.tsx` — реэкспорт страницы (`export { default } from "./ChatPage"`).
- `ChatPage.tsx` — оркестрация страницы, auth-гейт, ws-подключение, модалка создания чата.
- `Chat.module.css` — стили страницы и локальных модалок.

### Компоненты

- `components/ChatList.tsx` — левый столбик: список диалогов + кнопка "Створити чат".
- `components/ChatWindow.tsx` — правое окно: header выбранного чата, сообщения, отправка, подтверждение удаления.
- `components/CreateChatModal.tsx` — модалка создания чата (через общий `shared/Modal/Modal`).

### Данные и состояние

- `api/types.ts` — типы `ChatListItem`, `ChatMessage`, `ChatParticipant`.
- `api/chatApi.ts` — HTTP-обертки на `/api/chat/*` через общий `http.ts`.
- `store/chatStore.ts` — внешний store чата (state + actions + subscribe).
- `store/useChat.ts` — React-хук над `useSyncExternalStore`.

### Realtime

- `ws/chatWs.ts` — WebSocket выбранного чата (`/ws/chat/:chatId/`).
- `ws/counterWs.ts` — глобальный WebSocket счетчика (`/ws/counter/`).

### Интеграция с остальным приложением

- `src/App.tsx` — роут `/chat` (lazy: `import("./chat/Chat")`).
- `src/widgets/header/Header.tsx` — подключение `counterWs`, загрузка `chatStore.fetchChats()`, бейдж сообщений = `chatState.unreadTotal`.
- `src/api/endpoints.ts` — раздел `API.chat`.

---

## 2) HTTP API, который вызывает фронтенд

Используется `chatApi.ts` + `API.chat`:

- `GET /api/chat/` — список чатов (`getChats`).
- `GET /api/chat/{id}/messages/` — сообщения чата (`getChatMessages`).
- `POST /api/chat/create/` — создать чат (`createChat`), payload: `{ username, message? }`.
- `DELETE /api/chat/{id}/` — удалить чат (`deleteChat`).
- `POST /api/chat/{id}/mark_as_read/` — отметить как прочитанный (`markChatAsRead`).
- `POST /api/chat/{id}/send_message/` — fallback-отправка сообщения, если ws не открыт (`sendMessage`).

Все запросы идут через `api/http.ts`, значит:

- Bearer токен берется автоматически;
- при 401 работает refresh + retry (по общему механизму auth).

---

## 3) Store: что хранится и зачем

`chatStore.ts` хранит:

- `chats: ChatListItem[]`
- `messagesByChatId: Record<number, ChatMessage[]>`
- `selectedChatId: number | null`
- `loadingChats: boolean`
- `loadingMessages: Record<number, boolean>`
- `error: string | null`
- `unreadTotal: number`

Важные моменты реализации:

- подписка: `subscribeChat`;
- снапшот для React: `getChatStoreSnapshot` с кэшем по `storeVersion` (чтобы не было лишних циклов рендера);
- сортировка диалогов по `last_message.created_at`;
- защита от дублей сообщений по `message.id`;
- локальный unread total пересчитывается через `recalcUnreadTotalInternal`.

---

## 4) WebSocket-логика

## 4.1 `chatWs` (конкретный чат)

Файл: `ws/chatWs.ts`

- Подключение: `ws://.../ws/chat/{chatId}/?token={access}`.
- Токен: только из `auth/token.ts` (`getAccess()`), не из localStorage.
- Отправка: `sendMessage(text)` -> `{"message":"..."}`.
- Подписка на входящие: `onMessage(handler)`.

В `ChatPage.tsx`:

- при выборе `selectedChatId` подключается `chatWs.connect(selectedChatId)`;
- входящие сообщения идут в `actions.handleIncomingMessage(chatId, message, username)`.

## 4.2 `counterWs` (глобальный)

Файл: `ws/counterWs.ts`

- Подключение: `ws://.../ws/counter/?token={access}`.
- На `onopen` отправляется ping: `{"type":"ping"}`.
- События обновляют store через `applyCounterEvent`.

Где используется:

- в `Header.tsx` (глобально для авторизованного пользователя);
- `Header` на auth-сессии вызывает `chatActions.fetchChats()`, `counterWs.connect()`, подписывается на события.

---

## 5) Поведение страницы `/chat`

Файл: `ChatPage.tsx`

1. Берет auth-состояние из `useAuth()`.
2. Пока `!authReady` показывает "Завантаження…".
3. Если `!isAuthenticated` делает `<Navigate to="/login" />`.
4. После готовности и авторизации:
   - `fetchChats()`;
   - при `visibilitychange -> visible` повторно обновляет список чатов;
   - управляет `chatWs` для выбранного чата.

---

## 6) Логика кнопок (фактическая)

### "Створити чат" (`ChatList` -> `CreateChatModal`)

- Открывает `CreateChatModal`.
- Поля:
  - username (обязательно),
  - первое сообщение (необязательно).
- По submit:
  - вызывает `actions.createChat(username, firstMessage?)`;
  - если ошибка содержит "already exists"/"уже существует" -> `showWarning("Чат з цим користувачем вже створено.")`;
  - иначе `showError(...)`;
  - при успехе модалка закрывается.

### Выбор чата в списке

- `onSelect` -> `actions.selectChat(chatId)`.
- В `ChatWindow` при первой инициализации конкретного chatId:
  - `onLoadMessages(chatId)`;
  - `onMarkRead(chatId)` (`markReadLocal` + `markChatAsRead`).

### Отправка сообщения

- Кнопка submit в `ChatWindow`.
- Если есть живой ws на этом chatId -> отправка через `chatWs.sendMessage`.
- Иначе fallback через HTTP `sendMessageFallback`.

### "Видалити чат"

- Нажатие открывает confirm-модалку.
- Текст: "Ви впевнені що хочете видалити цей чат?"
- Кнопки:
  - `Ні` — закрыть;
  - `Так` — `onDeleteChat(chatId)`.

---

## 7) Как определяется "моё сообщение" (право/лево)

Файл: `components/ChatWindow.tsx`

Сообщение считается своим, если:

- `message.sender.id === currentUserId` (приоритетно), или
- fallback: username совпадает после нормализации (`trim().toLowerCase()`).

Это сделано потому, что в части ws-событий backend присылает только username.

---

## 8) Проверки и защиты

- В store:
  - `selectChat` не эмитит обновление, если chatId не изменился;
  - `fetchMessages` не запускается повторно, если уже грузится этот chatId;
  - `markReadLocal` не эмитит, если unread уже 0;
  - duplicate message guard по id.
- В `ChatWindow`:
  - `initializedChatRef` не дает заново триггерить load/read для того же chatId.
- В `CreateChatModal`:
  - disabled submit при пустом username.

---

## 9) Известные нюансы текущей реализации

- В dev может появляться предупреждение вида `WebSocket is closed before the connection is established` для `counterWs`, если соединение закрывается раньше завершения рукопожатия (например, при быстрых mount/unmount циклах).
- Левый список чатов не показывает отдельный бейдж unread (скрыт в UI), но `unreadTotal` сохраняется в store и используется в Header.

---

## 10) Файлы документации, связанные с чатом

- `frontend/src/docs/USER_DATA_FLOW.md` (добавлена секция про чат и auth-store/useAuth).
- `backend/docs/CHAT_BACKEND.md` (backend-часть: модели, API, consumers).
