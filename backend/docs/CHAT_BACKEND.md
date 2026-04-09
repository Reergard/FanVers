# Chat backend (`apps/chat`)

Документ описує поточну backend-реалізацію чату за фактичним кодом.

---

## 1) Де лежить код

- `backend/apps/chat/models.py`
- `backend/apps/chat/api/serializers.py`
- `backend/apps/chat/api/views.py`
- `backend/apps/chat/api/urls.py`
- `backend/apps/chat/routing.py`
- `backend/apps/chat/consumers.py`
- `backend/apps/chat/message_service.py` — єдине місце створення повідомлення: БД (`Message`, `Chat.last_message`), після `transaction.on_commit` — розсилка у `chat_*` та `counter_*`.
- `backend/apps/chat/unread_utils.py` — `unread_counts_for_user_in_chats` (один агрегуючий ORM-запит на список чатів) та `unread_message_count_for_participant` (per-chat fallback, 1–2 запити).
- `backend/apps/chat/counter_broadcast.py` — фабрики подій channel layer з внутрішнім типом **`counter_update`** (обробник у `CounterConsumer` віддає клієнту JSON з **`type: "message"`**).

Підключення в загальний API:

- `backend/apps/api/urls.py` → `path('chat/', include('apps.chat.api.urls'))`

WebSocket:

- `backend/FanVers_project/asgi.py` — `ProtocolTypeRouter` + `URLRouter(websocket_urlpatterns)`.

Пов’язано з сесією / logout:

- `backend/apps/users/ws_disconnect.py` — `broadcast_user_ws_disconnect(user_id)` → `group_send` у **`user_{user_id}`** з **`type: "force.disconnect"`** (викликається з `LogoutView`, щоб закрити WS чату та counter).

---

## 2) Моделі

Файл: `apps/chat/models.py`

### `Chat`

- `participants = ManyToMany(User, related_name="chats")`
- **`last_message = ForeignKey(Message, on_delete=SET_NULL, null=True, blank=True, related_name="+")`** — останнє повідомлення для прев’ю в списку; оновлюється в `message_service.create_chat_message`.
- `created_at`
- `updated_at` (`auto_now=True`)
- ordering: `-updated_at`

### `Message`

- `chat = ForeignKey(Chat, related_name="messages")`
- `sender = ForeignKey(User, related_name="sent_messages")`
- **`content = TextField(max_length=5000)`**
- `created_at`
- ordering: `created_at`
- **індекс** `msg_chat_sender_created_idx` на поля `(chat, sender, created_at)` — для підрахунку непрочитаних / фільтрів по чату.

### `ChatReadStatus`

- `chat = ForeignKey(Chat, related_name="read_statuses")`
- `user = ForeignKey(User, related_name="chat_read_statuses")`
- `last_read_at`
- `created_at`
- `updated_at` (`auto_now=True`)
- `unique_together = ['chat', 'user']`

Призначення: час останнього «прочитано» для розрахунку `unread_count`.

---

## 3) REST API

Файл: `apps/chat/api/urls.py`

Роутер:

- `router.register('', ChatViewSet, basename='chat')`

- `POST /api/chat/create/` → той самий handler `create_chat` (явний `path` у `urls.py`; **цей** URL використовує фронт у `API.chat.create`).
- Через `@action(detail=False, methods=["post"])` для `create_chat` DRF-router додатково може зареєструвати **`POST /api/chat/create_chat/`** — семантика та сама; для нового коду краще лишатися на **`/api/chat/create/`**, щоб не плодити варіанти.

### Ендпоінти `ChatViewSet` (`apps/chat/api/views.py`)

- `GET /api/chat/` — список чатів поточного користувача.
- `GET /api/chat/user-search/?q=...` — підказки користувачів для модалки (мін. 2 символи в `q`, до 15 результатів).
- `DELETE /api/chat/{id}/` — видалити чат (перед видаленням — `group_send` у `chat_{id}` з `chat_deleted`).
- **`POST /api/chat/create/`** (див. вище) — створити чат або дописати повідомлення в **існуючий** діалог; тіло: **`username` або `user`**, опційно **`message`**.
- `GET /api/chat/{id}/messages/` — **сторінка** повідомлень: `results`, `next_before` (див. нижче).
- `POST /api/chat/{id}/send_message/` — надіслати повідомлення через HTTP (fallback; логіка та сама, що й WS — через `create_chat_message`).
- `POST /api/chat/{id}/mark_as_read/` — оновити `ChatReadStatus.last_read_at` (+ WS у `counter_{user}` через `build_counter_read_reset_event`).

Auth / permissions:

- `permission_classes = [IsAuthenticated]`
- `authentication_classes = [JWTAuthentication]`
- queryset: `Chat.objects.filter(participants=request.user).distinct()`.

### Throttling (`ScopedRateThrottle` + `UserRateThrottle`)

`get_throttle_scope()`:

- `user_search` → **`chat_user_search`** (у `DEFAULT_THROTTLE_RATES`, напр. **30/min** — анти-enumeration).
- `create_chat` → **`chat_create`** (напр. **10/min** — анти-спам).
- інші дії → **`read_heavy`** (глобальний ліміт читання, напр. 240/min разом з `user`).

Конкретні числа — у `FanVers_project/settings.py` → `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`.

### `list()` і продуктивність

- Queryset: **`select_related("last_message__sender__profile")`** + **`prefetch_related(Prefetch(participants, User.objects.select_related("profile")))`**.
- Для всіх id чатів на сторінці один виклик **`unread_counts_for_user_in_chats(ids, request.user.id)`**; мапа передається в контекст серіалізатора як **`unread_by_chat_id`**.
- Окремого prefetch усіх `messages` для останнього повідомлення **немає** — використовується поле **`Chat.last_message`**.

### `messages` (курсорна пагінація)

- Query: **`limit`** (за замовчуванням 50, clamp 1…100), **`before`** — id повідомлення (опційно), повертаються повідомлення **старіші** за цей id.
- Відповідь: **`{ "results": [...], "next_before": <id | null> }`** — `next_before` для наступного запиту «ще старіші», або `null`, якщо ще немає.

### `create_chat` (поведінка)

- Розв’язання адресата: **`_resolve_user_for_chat`** — точний збіг за `username`, `profile.username`, email, pk; за довжиною запиту ≥ 2 — **один** fuzzy `icontains` по логіну/ніку; **кілька** збігів → **400** (`AmbiguousChatTargetError`).
- Користувач не знайдений → **404** з пояснювальним `error`.
- **Існуючий** чат між двома учасниками: повертається **200** і серіалізований чат (не 400); якщо передано `message` — викликається **`create_chat_message`** для цього чату.
- Новий чат: **201**; учасників додає після **`transaction.atomic()`** з **`User.objects.select_for_update()`** для обох pk (відсортовані) — зменшення race на дублікат чату.
- Поля тіла: окрім `username` / `user`, опційно **`message`**.

---

## 4) Серіалізація

Файл: `apps/chat/api/serializers.py`

### `UserSerializer`

Поля: `id`, `username`, `email`, `profile_image` (з `profile.image`, якщо є); помилки доступу до зображення — у лог.

### `ChatPartnerSearchSerializer`

Поля для підказок: `id`, `username`, `profile_username`, `profile_image` (аналогічне логування в `get_profile_image`).

### `MessageSerializer`

Поля: `id`, `sender` (`UserSerializer`), `content`, `created_at`.

### `ChatSerializer`

Поля: `id`, `participants`, `created_at`, `updated_at`, `last_message`, `unread_count`.

**`get_last_message`**: з **`obj.last_message`** через `MessageSerializer` (якщо `None` — `null`). При винятку — warning у лог і `null`.

**`get_unread_count`**: якщо в контексті є **`unread_by_chat_id`** (список чатів) — значення з мапи; інакше **`unread_message_count_for_participant(obj.id, request.user.id)`** (retrieve тощо).

---

## 5) WebSocket: маршрути та ASGI

### Маршрути (`apps/chat/routing.py`)

- `ws/chat/(?P<chat_id>[0-9]+)/$` → `ChatConsumer`
- `ws/counter/$` → `CounterConsumer`

### Auth (`FanVers_project/asgi.py`)

- **`SessionMiddlewareStack` + `AuthMiddlewareStack`** — автентифікація через **сесію (cookies)**, без токена в query string.
- **`AllowedHostsOriginValidator`** — перевірка Origin.

### Групи `user_{id}`

У **`connect`** і `ChatConsumer`, і `CounterConsumer` додається група **`user_{user.id}`**. Подія **`force.disconnect`** (з `LogoutView` через `broadcast_user_ws_disconnect`) закриває сокет з кодом **4401** (`WS_SESSION_ENDED_CODE` на фронті — без реконнекту).

### `ChatConsumer`

- `connect`: перевірка **`user.is_authenticated`**, участь у чаті, `group_add(chat_{id})`, **`group_add(user_{id})`**, `accept()`.
- `disconnect`: `group_discard` для `chat_*` та `user_*`.
- `receive`: JSON **`type: "ping"`** → **`pong`**; інакше поле **`message`** → **`create_chat_message`** (не дублювати логіку з REST). Обмеження: **до 10 повідомлень за 60 с** на з’єднання — інакше `close(4429)`. Довжина контенту **≤ 5000** (узгоджено з моделлю).
- Вихід у кімнату чату: `id`, `message`, `sender: { username }`, `timestamp` (без гарантії `sender.id` у WS-кадрі чату — у HTTP `MessageSerializer` id відправника є).
- `chat_deleted`: текстовий кадр з `type: "chat_deleted"`, потім закриття.
- `force_disconnect`: `close(4401)`.

### Лічильники після повідомлення

`create_chat_message` після commit викликає **`_broadcast_after_commit`**:

- `group_send(chat_{id}, type=chat_message)` — як вище;
- для кожного **іншого** учасника: `unread_message_count_for_participant` → `group_send(counter_{participant_id}, build_counter_message_event(...))`.

### `CounterConsumer`

- `connect` / `disconnect`: `counter_{user.id}` та **`user_{user.id}`** (як у чаті).
- `receive`: `{"type":"ping"}` → `{"type":"pong"}`.
- **`counter_update`** (внутрішній handler): клієнту відправляється JSON з **`type: "message"`**, полями `id`, `preview`, `sender`, `timestamp`, `chat_id`, за наявності **`unread_count`**. Після `mark_as_read`: `id: null`, `unread_count: 0` (див. `build_counter_read_reset_event`).

---

## 6) REST і синхронізація через channel layer

- **`send_message`** / **`create_chat`** з текстом — усе через **`create_chat_message`** (транзакція, `last_message`, on_commit broadcast).
- **`mark_as_read`** — `build_counter_read_reset_event` у **`counter_{request.user.id}`**.

---

## 7) Повний шлях даних «нове повідомлення»

1. Клієнт (WS або HTTP) → **`create_chat_message`**.
2. У транзакції: `Message.create`, оновлення **`Chat.last_message_id`** та **`updated_at`**.
3. `on_commit` → `chat_{id}` + `counter_*` для інших учасників.

---

## 8) Відомі деталі / обмеження

- У WS payload чату передається **`sender.username`**; для надійного «своє/чуже» на фронті є **`sender.id`** у відповідях REST.
- Реконнект після мережевих збоїв на фронті не вимикається через помилку **`authStatus()`**, крім **HTTP 401/403** (див. `isUnrecoverableSessionHttpError` у фронтовому коді).

---

**Останнє оновлення:** узгоджено з `message_service`, `Chat.last_message`, пагінацією `messages`, throttling, `user-search`, `ws_disconnect` / `force.disconnect`, `CounterConsumer.counter_update` → клієнтський `type: "message"`.
