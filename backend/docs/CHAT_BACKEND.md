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
- `backend/apps/chat/unread_utils.py` — синхронний підрахунок непрочитаних для одного `(chat_id, user_id)` (2 SQL-запити максимум).
- `backend/apps/chat/counter_broadcast.py` — фабрики подій `counter_update` для channel layer.

Підключення в загальний API:

- `backend/apps/api/urls.py` → `path('chat/', include('apps.chat.api.urls'))`

WebSocket:

- `backend/FanVers_project/asgi.py` — `ProtocolTypeRouter` + `URLRouter(websocket_urlpatterns)`.

---

## 2) Моделі

Файл: `apps/chat/models.py`

### `Chat`

- `participants = ManyToMany(User, related_name="chats")`
- `created_at`
- `updated_at` (`auto_now=True`)
- ordering: `-updated_at`

### `Message`

- `chat = ForeignKey(Chat, related_name="messages")`
- `sender = ForeignKey(User, related_name="sent_messages")`
- `content = TextField`
- `created_at`
- ordering: `created_at`
- **індекс** `msg_chat_sender_created_idx` на поля `(chat, sender, created_at)` — для запитів непрочитаних / фільтрів по чату.

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

Додатковий маршрут:

- `POST /api/chat/create/` → `create_chat`

### Ендпоінти `ChatViewSet` (`apps/chat/api/views.py`)

- `GET /api/chat/` → список чатів поточного користувача.
- `DELETE /api/chat/{id}/` → видалити чат.
- `POST /api/chat/create/` → створити чат за `username`, опційно з першим `message`.
- `GET /api/chat/{id}/messages/` → список повідомлень чату.
- `POST /api/chat/{id}/send_message/` → надіслати повідомлення через HTTP (fallback; також шле події WS — див. нижче).
- `POST /api/chat/{id}/mark_as_read/` → оновити `ChatReadStatus.last_read_at` (+ WS `counter_update` з `unread_count: 0` для синхрону вкладок).

Auth / permissions:

- `permission_classes = [IsAuthenticated]`
- `authentication_classes = [JWTAuthentication]`
- queryset: `Chat.objects.filter(participants=request.user)`.

### `list()` і продуктивність

У `list()` застосовується `prefetch_related` з `Prefetch`:

- `messages` — `Message.objects.select_related("sender__profile")`;
- `read_statuses` — лише для `request.user`, `to_attr="user_read_statuses"`;
- `participants` — `User.objects.select_related("profile")`.

Це прибирає N+1 при серіалізації `last_message`, `unread_count` та учасників.

---

## 4) Серіалізація

Файл: `apps/chat/api/serializers.py`

### `UserSerializer`

Поля: `id`, `username`, `email`, `profile_image` (з `profile.image`, якщо є).

### `MessageSerializer`

Поля: `id`, `sender` (`UserSerializer`), `content`, `created_at`.

### `ChatSerializer`

Поля: `id`, `participants`, `created_at`, `updated_at`, `last_message`, `unread_count`.

**`get_last_message`**: з кешу prefetch — `list(obj.messages.all())`, останній елемент `msg_list[-1]` (ordering повідомлень за `created_at` ASC).

**`get_unread_count`**: у `Meta.fields` поле `last_message` йде **перед** `unread_count`, тож після `get_last_message` prefetch повідомлень уже «прогрітий». Далі ітерація по `obj.messages.all()` без зайвого другого `list()`. Якщо `user_read_statuses` з prefetch відсутні (наприклад, detail без того ж prefetch) — fallback через `ChatReadStatus.objects.get(chat=obj, user_id=uid)`.

Логіка підрахунку та сама, що в `unread_utils.unread_message_count_for_participant`: повідомлення від **інших**, після `last_read_at` або всі такі, якщо статусу читання не було.

---

## 5) WebSocket: маршрути та ASGI

### Маршрути (`apps/chat/routing.py`)

- `ws/chat/(?P<chat_id>[0-9]+)/$` → `ChatConsumer` (лише числовий `chat_id`, узгоджено з `int(...)` у `connect`).
- `ws/counter/$` → `CounterConsumer`

### Auth (`FanVers_project/asgi.py`)

- **`SessionMiddlewareStack` + `AuthMiddlewareStack`** — автентифікація через **сесію (cookies)**, без токена в query string (узгоджено з фронтом і OWASP).
- **`AllowedHostsOriginValidator`** — перевірка Origin.

### `ChatConsumer`

- `connect`: `chat_id = int(kwargs["chat_id"])`, перевірка **`user.is_authenticated`** (AnonymousUser не проходить), перевірка участі в чаті, `group_add(chat_{id})`, `accept()`.
- `disconnect`: `group_discard` лише якщо є `chat_group_name`; лог лише для автентифікованого користувача.
- `receive`: JSON з полем `message` → збереження в БД → `group_send` у `chat_{id}` типу `chat_message` → **`send_counter_updates`** (личильники для інших учасників).
- Вихідне повідомлення в кімнату чату: `id`, `message`, `sender: { username }`, `timestamp`.

### `send_counter_updates` та лічильники

- Для кожного учасника, крім відправника, обчислюється **`unread_message_count_for_participant(chat_id, user_id)`** і в групу `counter_{user_id}` відправляється подія через **`build_counter_message_event`** (включно з **`unread_count`**).

### `CounterConsumer`

- `connect`: лише автентифіковані користувачі; `group_add(counter_{user.id})`.
- `disconnect`: безпечний `group_discard` через `getattr(..., "counter_group_name", None)`.
- `receive`: `{"type":"ping"}` → `{"type":"pong"}`.
- **`counter_update`** (вихід клієнту): `type: "message"`, `id`, `message`, `sender`, `timestamp`, `chat_id`, за наявності — **`unread_count`**. Окремий варіант (після `mark_as_read`): можливі `id: null`, порожній `message`, **`unread_count: 0`**.

---

## 6) REST і синхронізація через channel layer

Щоб відкрита сторінка чату та бейджі не розходилися з БД:

- **`send_message`**: після `Message.objects.create` — **`group_send`** у **`chat_{chat.id}`** з типом **`chat_message`** (як у consumer) + розсилка **`counter_update`** іншим учасникам (як у `send_counter_updates`).
- **`create_chat`**: якщо створено перше повідомлення — аналогічно **`counter_update`** для адресата.
- **`mark_as_read`**: після оновлення статусу — **`build_counter_read_reset_event`** у **`counter_{request.user.id}`** (`unread_count: 0` для цього чату на всіх вкладках користувача).

---

## 7) Повний шлях даних «нове повідомлення»

**Через WS чату:**

1. Клієнт шле JSON у `ChatConsumer` (`ws/chat/{id}/`).
2. `save_message` створює `Message`.
3. `group_send(chat_{id})` — учасникам відкритого чату.
4. `send_counter_updates` — у `counter_{інший_юзер}` з актуальним **`unread_count`**.

**Через HTTP `send_message`:**

1. Запис у БД.
2. Той самий `chat_{id}` + `counter_*`, як вище.

---

## 8) Відомі деталі / обмеження

- У `views.py` у `create_chat` та інших місцях можуть залишатися **`print(...)`** для дебагу — варто прибрати в продакшні за потреби.
- Помилка «чат вже існує»: **400** з текстом на кшталт `Чат с пользователем {username} уже существует` (українська/російська формулювання залежить від коду).
- У WS payload відправника в чаті передається **`username`**; окремий `sender.id` у кадрі чату може бути відсутній — фронт має fallback за username.
