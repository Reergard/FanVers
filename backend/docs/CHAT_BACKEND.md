# Chat backend (`apps/chat`)

Документ описывает текущую backend-реализацию чата по фактическому коду.

---

## 1) Где находится код

- `backend/apps/chat/models.py`
- `backend/apps/chat/api/serializers.py`
- `backend/apps/chat/api/views.py`
- `backend/apps/chat/api/urls.py`
- `backend/apps/chat/routing.py`
- `backend/apps/chat/consumers.py`

Подключение в общий API:

- `backend/apps/api/urls.py` -> `path('chat/', include('apps.chat.api.urls'))`

---

## 2) Модели

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

### `ChatReadStatus`

- `chat = ForeignKey(Chat, related_name="read_statuses")`
- `user = ForeignKey(User, related_name="chat_read_statuses")`
- `last_read_at`
- `created_at`
- `updated_at` (`auto_now=True`)
- `unique_together = ['chat', 'user']`

Назначение: хранит "когда пользователь последний раз прочитал чат" для расчета `unread_count`.

---

## 3) REST API

Файл: `apps/chat/api/urls.py`

Роутер:

- `router.register('', ChatViewSet, basename='chat')`

Доп. маршрут:

- `POST /api/chat/create/` -> `create_chat`

### Эндпоинты `ChatViewSet` (`apps/chat/api/views.py`)

- `GET /api/chat/` -> список чатов текущего пользователя.
- `DELETE /api/chat/{id}/` -> удалить чат.
- `POST /api/chat/create/` -> создать чат по `username`, опционально с первым `message`.
- `GET /api/chat/{id}/messages/` -> список сообщений чата.
- `POST /api/chat/{id}/send_message/` -> отправить сообщение в чат через HTTP.
- `POST /api/chat/{id}/mark_as_read/` -> обновить `ChatReadStatus.last_read_at`.

Auth/permissions:

- `permission_classes = [IsAuthenticated]`
- `authentication_classes = [JWTAuthentication]`
- queryset ограничен `Chat.objects.filter(participants=request.user)`.

---

## 4) Серилизация

Файл: `apps/chat/api/serializers.py`

### `UserSerializer`

Поля:

- `id`
- `username`
- `email`
- `profile_image` (из `profile.image`, если есть)

### `MessageSerializer`

Поля:

- `id`
- `sender` (`UserSerializer`)
- `content`
- `created_at`

### `ChatSerializer`

Поля:

- `id`
- `participants`
- `created_at`
- `updated_at`
- `last_message` (последнее сообщение)
- `unread_count` (вычисляемое поле)

Как считается `unread_count`:

1. Берется `ChatReadStatus(chat, user)`; если нет — считается, что пользователь никогда не открывал чат.
2. Считаются сообщения от **других** пользователей:
   - если есть `last_read_at` -> `created_at > last_read_at`;
   - иначе -> все сообщения от других.

---

## 5) WebSocket

### Маршруты (`apps/chat/routing.py`)

- `ws/chat/<chat_id>/` -> `ChatConsumer`
- `ws/counter/` -> `CounterConsumer`

### Auth middleware (`TokenAuthMiddleware`, `apps/chat/consumers.py`)

- ожидает `token` в query-string: `?token=...`;
- валидирует через `AccessToken`;
- кладет `scope['user']`.

### `ChatConsumer`

- при connect:
  - проверяет авторизацию;
  - проверяет, что пользователь участник чата;
  - подписывает соединение на группу `chat_{chat_id}`.
- при receive:
  - ожидает JSON с полем `message`;
  - сохраняет сообщение в БД;
  - рассылает в `chat_{chat_id}` событие `chat_message`;
  - рассылает счетчик другим участникам через `counter_{user_id}`.

Формат исходящего сообщения в чат:

- `id`
- `message`
- `sender: { username }`
- `timestamp`

### `CounterConsumer`

- при connect подписывает пользователя на `counter_{user.id}`.
- принимает `{"type":"ping"}` и отвечает `{"type":"pong"}`.
- отправляет события новых сообщений:
  - `type: "message"`
  - `id`
  - `message`
  - `sender`
  - `timestamp`
  - `chat_id`

---

## 6) Особенности текущей реализации

- WebSocket auth сделан через query-string token.
- В ws payload sender сейчас отдается с `username`; отдельный `sender.id` в ws событии не отправляется.
- В `views.py` и `consumers.py` есть `print(...)` / debug-логи.
- Ошибка "чат уже существует" отдается как `400` с текстом: `Чат с пользователем {username} уже существует`.

---

## 7) Полный путь данных "новое сообщение"

1. Клиент отправляет сообщение в `ChatConsumer` (`ws/chat/{id}`).
2. `save_message` создает запись `Message`.
3. `group_send(chat_{id})` доставляет сообщение участникам открытого чата.
4. `send_counter_updates` шлет событие в `counter_{other_user_id}`.
5. Клиенты с подключенным `ws/counter/` обновляют список чатов / счетчики.
