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
2. Поки `!authReady` — «Завантаження…» (з `Breadcrumb`).
3. Якщо `!isAuthenticated` — **інлайн-блок** із заголовком, текстом і `ActionButton` «Увійти» (відкриває `openLoginModal("/chat")`); **не** редирект на `/login`.
4. Після авторизації: **`fetchChats()`**; при **`visibilitychange` → visible** — знову **`fetchChats()`**.
5. `chatWs` підключається до **`selectedChatId`**; у cleanup — `offMessage` + **`disconnect()`**.
6. **Scroll-to-content** при першому завантаженні: `useLayoutEffect` прокручує сторінку до `div.layout` (ref `layoutRef`) через `scrollIntoView({ block: "start" })`, щоб хедер і меню сайту не були видні — відразу показується блок чату. Спрацьовує **один раз** (guard `didInitialScrollRef`), **до** paint (без видимого стрибка).
7. **Верхня панель** (`chatTopBar`): `Breadcrumb` + бейдж статусу WS-з'єднання (`chatWsStatus`: `connected` / `reconnecting` / `disconnected`) — показується лише коли обрано конкретний чат.

---

## 6) Кнопки та дії (фактично)

### «Створити чат» → `CreateChatModal`

- Пошук за підрядком (API `user-search`); submit → `createChat(username, firstMessage?)`. Неоднозначний збіг / валідація — повідомлення з API; дублікат чату обробляється як успіх (200) з наявним діалогом.
- Поле **«Перше повідомлення»** — `textarea` (не `input`): зберігає переноси рядків і абзаци при вставці довгого тексту.
- При довгому першому повідомленні модалка **розширюється** (див. §10); кнопка **«Створити»** — золотий primary (`.createPrimaryBtn`).

### Поле вводу в обраному чаті (`ChatWindow`)

- Композер — **`textarea`** (клас `.input` у `Chat.module.css`), не однострочний `input`.
- **Enter** — надіслати; **Shift+Enter** — новий рядок.
- Текст передається на бекенд як є (лише `.trim()` по краях усього повідомлення); бекенд теж робить `strip()` лише зовнішніх пробілів — внутрішні `\n` зберігаються.

### Вибір чату в списку

- `selectChat(chatId)`; у **`ChatList`** для чатів з **`unread_count > 0`** показується **`.unreadBadge`**.
- У `ChatWindow` при ініціалізації чату: **`fetchMessages`** (перша сторінка) + **`markReadLocal` + `markChatAsRead`**; скрол вгору — **`loadOlderMessages`** за `messagesOlderCursor`.
- При відкритті чату **показується останнє повідомлення** (низ списку): внутрішній скрол контейнера `.messages` (`el.scrollTop = el.scrollHeight`) у `useLayoutEffect` — до paint, без стрибка.

### Відправка повідомлення

- Якщо WS відкритий — `chatWs.sendMessage`; інакше **`sendMessage`** (HTTP). Бекенд у обох випадках оновлює БД і шле події в кімнату чату та counter.
- Після відправки — **автоматичний скрол** до нового повідомлення: `requestAnimationFrame(scrollToBottom)` після `setText("")`, щоб React встиг відрендерити повідомлення перед скролом.

### «Видалити чат»

- Підтвердження → `deleteChat(chatId)`.

---

## 7) «Моє повідомлення» (ліво / право)

`ChatWindow.tsx`: своє, якщо `message.sender.id === userId` або fallback за нормалізованим `username` (WS інколи дає лише username).

### Відображення тексту повідомлень

Стилі в `Chat.module.css`:

| Клас | Призначення |
|------|-------------|
| `.msgText` | Базовий блок тексту: `white-space: pre-wrap` — **зберігає переноси рядків** з БД/WS; шрифт BadScript. |
| `.msgTextLeft` | Вхідні (чужі): колір золотий `rgba(241, 157, 16, …)`, вирівнювання за замовчуванням по лівому краю. |
| `.msgTextRight` | Власні: колір бірюзовий `rgba(8, 184, 206, …)`; блок справа (`justify-self: end`); **текст усередині блоку** — `text-align: justify` + `text-align-last: start` (останній рядок абзацу не розтягується). |

Важливо: позиція бульбашки (ліво/право) і вирівнювання тексту всередині неї — різні речі. Блок власного повідомлення притиснутий до правого краю стрічки, але рядки тексту заповнюють ширину самого блоку.

Повідомлення, надіслані **до** переходу на `textarea` в композері, могли зберегтися в БД без `\n` (старий однострочний `input` склеював абзаци) — їх потрібно надіслати знову, щоб відновити форматування.

---

## 8) Захисти та перевірки

- Store: `selectChat` без зайвого emit; `fetchMessages` / завантаження старіших не дублюються під час завантаження; `markReadLocal` якщо вже 0; дедуп повідомлень за `id`.
- `ChatWindow`: `initializedChatRef` уникає повторних load/read для того ж `chatId`.
- `CreateChatModal`: submit залежить від валідного вибору користувача / полів (див. код).

---

## 8.1) Layout та адаптивність

### Загальна структура

Сторінка чату (`ChatPage`) складається з:
- `section.page` → `Container` (верхня панель: breadcrumb + WS-бейдж) → `div.layout` (CSS Grid: sidebar + chatPanel).

### Desktop (> 768px)

- **`.layout`**: CSS Grid `grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr)`, `min-height: clamp(620px, 76svh, 900px)`, `align-items: start`.
- **`.sidebar`**: `position: sticky; top: 0; align-self: start; max-height: 100svh; overflow-y: auto` — залишається на місці при скролі сторінки. Працює завдяки `overflow-x: clip` (не `hidden`) на `.app` у `Base.module.css` — `clip` не створює scroll-контейнер і не ламає sticky.
- **`.chatPanel`**: `height: clamp(620px, 92svh, 1400px)` — **явна висота** необхідна для внутрішнього скролу повідомлень. `grid-template-rows: auto minmax(0, 1fr) auto` — header / messages / composer; `minmax(0, 1fr)` на `.messages` запобігає розтягуванню контейнера під контент.
- **Внутрішній скрол** `.messages` (`overflow-y: auto`): при відкритті чату прокручується до останнього повідомлення; при підвантаженні старіших — позиція зберігається через `scrollAnchorRef` (`{ top, height }` → `el.scrollTop = anchor.top + growth`).

### Mobile (≤ 768px)

- **`.layout`**: `grid-template-columns: minmax(0, 1fr)` (одна колонка). `minmax(0, …)` замість `1fr` запобігає виходу контенту за межі екрана (бо `1fr` = `minmax(auto, 1fr)`, а `auto` мінімум розширює колонку під довгий текст).
- **`.sidebar`**: `position: static` (скидання sticky), горизонтальний список чатів.
- **`.chatListInner`**: `display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch` — **горизонтальний свайп** пальцем по списку чатів. Смуга прокрутки прихована (`scrollbar-width: none` + `::-webkit-scrollbar { width: 0; height: 0 }`). Кожен `li` має `width: clamp(200px, 44vw, 300px); flex-shrink: 0` — фіксована ширина, не стискається.
- **`.chatHeader`**: `overflow: hidden` на заголовку і його дочірніх елементах; `.headerTitle` — `text-overflow: ellipsis; white-space: nowrap` для довгих імен. `.chatHeaderActions` — `flex-shrink: 0` (кнопка «Видалити» не обрізається).
- **`.chatPanel`**: `height: auto; min-height: clamp(540px, 72svh, 860px); padding-bottom: 70px` — скидання desktop-висоти, відступ під фіксований composer.
- **`.composer`**: `position: fixed; bottom: 0; left: 0; right: 0; z-index: 10; background-color: #020a0b` — **прибитий до низу екрана**. Колір фону збігається з `body` (`#020a0b` у `main.css`), щоб не було прозорості.

### Важливі CSS-залежності

| Що | Чому саме так |
|----|---------------|
| `overflow-x: clip` на `.app` | `hidden` створює scroll-контейнер → ламає `position: sticky`. `clip` візуально обрізає, але не створює scroll-контейнер. |
| Явна `height` на `.chatPanel` (desktop) | `min-height` батьківського grid не створює definite row track → `.messages` з `overflow: auto` не має обмеження висоти → скрол не працює. |
| `minmax(0, 1fr)` у mobile grid | `1fr` = `minmax(auto, 1fr)` → `auto` мінімум розширює колонку під довгий контент → overflow за viewport. |
| `width` (не `min-width`) на `.chatListInner > li` | `min-width` не дає definite ширину → `chatItem` з `inline-size: 100%` розтягується під текст. |

---

## 9) Нюанси

- У dev можливе попередження браузера про закриття WebSocket до завершення handshake при швидких mount/unmount — зазвичай не критично.
- Бекенд тримає **`last_message`** на моделі `Chat`; порядок полів у `ChatSerializer` не вимагає prefetch усіх повідомлень для прев’ю.

---

## 10) UI: поля вводу, скролбари, модалка створення

### Загальні скролбари на сайті

Файл **`frontend/src/shared/scrollbars.css`**, підключення в **`main.tsx`** після `main.css`.

CSS-змінні в `:root` (`main.css`):

- `--fv-native-scrollbar-size` — `8px`
- `--fv-native-scrollbar-thumb` — `#f58807` (золотий акцент сайту)
- `--fv-native-scrollbar-thumb-hover` — `#f9a032`
- `--fv-native-scrollbar-track` — `rgba(10, 18, 20, 0.72)`

Автоматично застосовується до **`textarea`**, **`select`** і елементів з класом **`.fv-native-scrollbar`**.

У чаті на композері та в модалці створення додатково клас **`fv-native-scrollbar`** і дубльовані правила в `Chat.module.css` (`.input`, `.createTextarea`) — для надійності в CSS Modules.

**Свідомо без скролбара** (локальні override): список повідомлень `.messages`, список чатів `.chatListInner` — нативний скрол лишається, смуга прихована.

### Композер чату (`ChatWindow` → `.input`)

| Аспект | Реалізація |
|--------|------------|
| Елемент | `textarea`, не `input type="text"` |
| Контейнер | `.inputShell` — «пігулка» з золотою рамкою, `border-radius: 999px` |
| Шрифт / колір | BadScript, золотий текст `rgba(241, 157, 16, …)` |
| Висота | **Auto-grow**: 1 рядок → росте з текстом до `max-block-size: clamp(12rem, 34vh, 20rem)`, далі внутрішній скрол; логіка в `ChatWindow.syncComposerHeight` |
| Форма оболонки | Одна строка — «пігулка» (`border-radius: 999px`); кілька рядків — `.inputShellMultiline` з м’якшим скругленням |
| Клавіатура | Enter → submit; Shift+Enter → `\n` |
| Скролбар | Кастомний золотий (див. вище) |

### Модалка «Створити чат» (`CreateChatModal`)

Базові класи: `.createModal`, `.createForm`, `.createTextarea`, `.createPrimaryBtn` / `.createSecondaryBtn` у `Chat.module.css`; обгортка — `shared/Modal/Modal`.

**Розширений режим** (`isLongFirstMessage` у `CreateChatModal.tsx`):

- Умова: `firstMessage.length >= 100` **або** `>= 3` рядки (`\n`).
- Класи: `.createModalExpanded`, `.createFormExpanded`, `.createMessageField`, `.createTextareaExpanded`.
- Розмір модалки: **до `95vh` висоти**, **до `820px` / `96vw` ширини**.
- **Скрол модалки вимкнено** (`overflow: hidden` на `.createModalExpanded`) — прокручується **лише textarea** всередині форми (flex/grid ланцюг: modal → content → form → message field → wrap → textarea).
- Підказка ручного resize: подвійний куток (бірюза + золото), символ ↘, `title` на textarea; `resize: vertical` збережено.
- Кнопка **«Створити»**: золотий градієнт, білий текст (`.createPrimaryBtn`); disabled — приглушений золотий фон, поки не введено логін.

**Компактний режим** (короткий текст): модалка ~`560px`, textarea `rows={3}`.

### Кнопки в модалках чату

| Клас | Стиль |
|------|--------|
| `.createSecondaryBtn` | Прозорий фон, біла обводка — «Скасувати» / «Ні» |
| `.createPrimaryBtn` | Золотий градієнт `#f59a14 → #e07800`, білий текст — «Створити» / «Так» |

Акцент узгоджений з іншими золотими елементами чату (напр. `.deleteChatBtn`, `.createChat`).

### Де правити

| Що змінити | Файл |
|------------|------|
| Вирівнювання / колір тексту повідомлень | `chat/Chat.module.css` — `.msgText`, `.msgTextLeft`, `.msgTextRight` |
| Композер, клавіатура | `chat/components/ChatWindow.tsx` |
| Модалка створення, поріг «довгого» тексту | `chat/components/CreateChatModal.tsx`, `isLongFirstMessage` |
| Розміри розширеної модалки, resize-hint | `chat/Chat.module.css` — `.createModalExpanded`, `.createTextareaWrapHint` |
| Глобальний скролбар полів | `shared/scrollbars.css`, змінні в `main.css`, імпорт у `main.tsx` |

---

## 11) Пов’язана документація

- `frontend/src/docs/USER_DATA_FLOW.md` — чат і header у контексті auth.
- `backend/docs/CHAT_BACKEND.md` — моделі, REST, pagination, consumers, `message_service`, throttling, `user-search`.

---

**Останнє оновлення:** layout та адаптивність (§8.1) — sticky sidebar (desktop), внутрішній скрол повідомлень з явною `height` на `.chatPanel`, scroll-to-content при завантаженні сторінки, горизонтальний свайп списку чатів (mobile), фіксований composer (mobile), `overflow-x: clip` на `.app`, `minmax(0, 1fr)` проти overflow, auto-scroll після відправки, WS-бейдж статусу, інлайн auth-gate замість redirect.
