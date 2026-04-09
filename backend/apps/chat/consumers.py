import json
import logging
import time
from collections import deque

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Chat
from .message_service import create_chat_message

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = int(self.scope["url_route"]["kwargs"]["chat_id"])
        self.chat_group_name = f"chat_{self.chat_id}"
        self.message_timestamps = deque(maxlen=10)
        
        # AuthMiddlewareStack завжди підставляє user (у т.ч. AnonymousUser — truthy)
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Проверяем, что пользователь является участником чата
        if not await self.is_chat_participant(self.chat_id, self.user):
            await self.close()
            return
        
        # Присоединяемся к группе чата
        await self.channel_layer.group_add(
            self.chat_group_name,
            self.channel_name
        )

        self.user_ws_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_ws_group, self.channel_name)

        await self.accept()
        logger.info(f"User {self.user.username} connected to chat {self.chat_id}")

    async def disconnect(self, close_code):
        group_name = getattr(self, "chat_group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
        user_ws = getattr(self, "user_ws_group", None)
        if user_ws:
            await self.channel_layer.group_discard(user_ws, self.channel_name)
        user = getattr(self, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            logger.info(f"User {user.username} disconnected from chat {self.chat_id}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
                return

            message = data.get('message', '').strip()

            # Max 10 messages / 60 sec per user (per connection)
            now = time.time()
            self.message_timestamps.append(now)
            if (
                len(self.message_timestamps) == self.message_timestamps.maxlen
                and (now - self.message_timestamps[0]) < 60
            ):
                await self.close(code=4429)
                return

            if message:
                if len(message) > 5000:
                    await self.send(text_data=json.dumps({"error": "Message too long"}))
                    return
                try:
                    await self.save_message(self.chat_id, self.user, message)
                except ValueError as e:
                    if str(e) == "Chat not found":
                        await self.close(code=4404)
                    else:
                        await self.send(
                            text_data=json.dumps({"error": "Invalid message"})
                        )
                except PermissionError:
                    await self.close(code=4403)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))
        except Exception as e:
            logger.error(f"Error in receive: {e}")
            await self.send(text_data=json.dumps({'error': 'Internal server error'}))

    async def chat_message(self, event):
        # Отправляем сообщение WebSocket клиенту
        await self.send(text_data=json.dumps({
            'id': event['id'],
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp']
        }))

    async def force_disconnect(self, _event):
        await self.close(code=4401)

    async def chat_deleted(self, _event):
        await self.send(text_data=json.dumps({"type": "chat_deleted"}))
        await self.close()

    @database_sync_to_async
    def is_chat_participant(self, chat_id, user):
        try:
            chat = Chat.objects.get(id=chat_id)
            return user in chat.participants.all()
        except Chat.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, chat_id, user, content):
        try:
            create_chat_message(chat_id=chat_id, sender=user, content=content)
        except Chat.DoesNotExist:
            raise ValueError("Chat not found") from None


class CounterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Присоединяемся к группе счетчиков пользователя
        self.counter_group_name = f'counter_{self.user.id}'
        await self.channel_layer.group_add(
            self.counter_group_name,
            self.channel_name
        )

        self.user_ws_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_ws_group, self.channel_name)

        await self.accept()
        logger.info(f"User {self.user.username} connected to counter WebSocket")

    async def disconnect(self, close_code):
        group_name = getattr(self, "counter_group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
        user_ws = getattr(self, "user_ws_group", None)
        if user_ws:
            await self.channel_layer.group_discard(user_ws, self.channel_name)
        user = getattr(self, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            logger.info(f"User {user.username} disconnected from counter WebSocket")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))

    async def counter_update(self, event):
        payload = {
            "type": "message",
            "id": event.get("id"),
            "preview": event.get("preview", ""),
            "sender": event["sender"],
            "timestamp": event["timestamp"],
            "chat_id": event["chat_id"],
        }
        if event.get("unread_count") is not None:
            payload["unread_count"] = event["unread_count"]
        await self.send(text_data=json.dumps(payload))

    async def force_disconnect(self, _event):
        await self.close(code=4401)