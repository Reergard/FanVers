import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .counter_broadcast import build_counter_message_event
from .models import Chat, Message
from .unread_utils import unread_message_count_for_participant

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = int(self.scope["url_route"]["kwargs"]["chat_id"])
        self.chat_group_name = f"chat_{self.chat_id}"
        
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
        
        await self.accept()
        logger.info(f"User {self.user.username} connected to chat {self.chat_id}")

    async def disconnect(self, close_code):
        group_name = getattr(self, "chat_group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
        user = getattr(self, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            logger.info(f"User {user.username} disconnected from chat {self.chat_id}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message = data.get('message', '').strip()
            
            if message:
                # Сохраняем сообщение в базу данных
                message_obj = await self.save_message(self.chat_id, self.user, message)
                
                # Отправляем сообщение всем участникам чата
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'chat_message',
                        'message': message_obj['content'],
                        'sender': {
                            'username': self.user.username,
                        },
                        'timestamp': message_obj['created_at'],
                        'id': message_obj['id']
                    }
                )
                
                # Отправляем уведомление о счетчике всем участникам чата
                await self.send_counter_updates(self.chat_id, message_obj, self.user)
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
            chat = Chat.objects.get(id=chat_id)
            message = Message.objects.create(
                chat=chat,
                sender=user,
                content=content
            )
            return {
                'id': message.id,
                'content': message.content,
                'created_at': message.created_at.isoformat()
            }
        except Chat.DoesNotExist:
            raise Exception("Chat not found")

    async def send_counter_updates(self, chat_id, message_obj, sender):
        """Уведомления счётчика: реальный unread_count с БД для каждого получателя."""
        try:
            chat = await self.get_chat(chat_id)
            if not chat:
                return
            participants = await self.get_chat_participants(chat)

            for participant in participants:
                if participant.id == sender.id:
                    continue
                unread_count = await self.compute_unread_for_participant(chat_id, participant.id)
                await self.channel_layer.group_send(
                    f"counter_{participant.id}",
                    build_counter_message_event(
                        chat_id=chat_id,
                        message_id=message_obj["id"],
                        message_text=message_obj["content"],
                        sender_username=sender.username,
                        timestamp_iso=message_obj["created_at"],
                        unread_count=unread_count,
                    ),
                )
        except Exception as e:
            logger.error(f"Error sending counter updates: {e}")

    @database_sync_to_async
    def compute_unread_for_participant(self, chat_id, user_id):
        return unread_message_count_for_participant(chat_id, user_id)

    @database_sync_to_async
    def get_chat(self, chat_id):
        try:
            return Chat.objects.get(id=chat_id)
        except Chat.DoesNotExist:
            return None

    @database_sync_to_async
    def get_chat_participants(self, chat):
        if chat:
            return list(chat.participants.all())
        return []


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
        
        await self.accept()
        logger.info(f"User {self.user.username} connected to counter WebSocket")

    async def disconnect(self, close_code):
        group_name = getattr(self, "counter_group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
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
            "message": event.get("message", ""),
            "sender": event["sender"],
            "timestamp": event["timestamp"],
            "chat_id": event["chat_id"],
        }
        if event.get("unread_count") is not None:
            payload["unread_count"] = event["unread_count"]
        await self.send(text_data=json.dumps(payload))