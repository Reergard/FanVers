import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Chat, Message

User = get_user_model()
logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        
        # Получаем пользователя из middleware
        self.user = self.scope.get('user')
        if not self.user:
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
        # Покидаем группу чата
        await self.channel_layer.group_discard(
            self.chat_group_name,
            self.channel_name
        )
        logger.info(f"User {self.user.username} disconnected from chat {self.chat_id}")

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
        """Отправляет уведомления о счетчике всем участникам чата"""
        try:
            chat = await self.get_chat(chat_id)
            participants = await self.get_chat_participants(chat)
            
            for participant in participants:
                if participant.id != sender.id:  # Не отправляем себе
                    await self.channel_layer.group_send(
                        f'counter_{participant.id}',
                        {
                            'type': 'counter_update',
                            'id': message_obj['id'],
                            'message': message_obj['content'],
                            'sender': {
                                'username': sender.username,
                            },
                            'timestamp': message_obj['created_at'],
                            'chat_id': chat_id
                        }
                    )
        except Exception as e:
            logger.error(f"Error sending counter updates: {e}")

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
        # Получаем пользователя из middleware
        self.user = self.scope.get('user')
        if not self.user:
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
        # Покидаем группу счетчиков
        await self.channel_layer.group_discard(
            self.counter_group_name,
            self.channel_name
        )
        logger.info(f"User {self.user.username} disconnected from counter WebSocket")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))

    async def counter_update(self, event):
        # Отправляем обновление счетчика клиенту
        await self.send(text_data=json.dumps({
            'type': 'message',
            'id': event['id'],
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp'],
            'chat_id': event['chat_id']
        }))