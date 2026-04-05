from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from ..models import Chat, Message, ChatReadStatus
from .serializers import ChatSerializer, MessageSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ..counter_broadcast import build_counter_message_event, build_counter_read_reset_event
from ..unread_utils import unread_message_count_for_participant

User = get_user_model()

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            raise AuthenticationFailed('User not authenticated')
        return Chat.objects.filter(participants=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().prefetch_related(
            Prefetch(
                "messages",
                queryset=Message.objects.select_related("sender__profile"),
            ),
            Prefetch(
                "read_statuses",
                queryset=ChatReadStatus.objects.filter(user=request.user),
                to_attr="user_read_statuses",
            ),
            Prefetch(
                "participants",
                queryset=User.objects.select_related("profile"),
            ),
        )
        serializer = self.get_serializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def create_chat(self, request):
        if not request.user.is_authenticated:
            raise AuthenticationFailed('User not authenticated')
            
        print(f"Create chat request from user: {request.user}")
        print(f"Request data: {request.data}")
        
        username = request.data.get('username')
        message = request.data.get('message')
        
        try:
            other_user = User.objects.get(username=username)
            print(f"Found other user: {other_user}")
            
            existing_chat = Chat.objects.filter(
                participants=request.user
            ).filter(
                participants=other_user
            ).first()
            
            if existing_chat:
                return Response(
                    {'error': f'Чат с пользователем {username} уже существует'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            chat = Chat.objects.create()
            chat.participants.add(request.user, other_user)

            created_msg = None
            if message:
                created_msg = Message.objects.create(
                    chat=chat,
                    sender=request.user,
                    content=message
                )

            if created_msg is not None:
                channel_layer = get_channel_layer()
                for participant in chat.participants.all():
                    if participant.id == request.user.id:
                        continue
                    unread_count = unread_message_count_for_participant(chat.id, participant.id)
                    async_to_sync(channel_layer.group_send)(
                        f"counter_{participant.id}",
                        build_counter_message_event(
                            chat_id=chat.id,
                            message_id=created_msg.id,
                            message_text=created_msg.content,
                            sender_username=request.user.username,
                            timestamp_iso=created_msg.created_at.isoformat(),
                            unread_count=unread_count,
                        ),
                    )

            print(f"Created chat: {chat}")
            return Response(
                self.serializer_class(chat, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        except User.DoesNotExist:
            print(f"User not found: {username}")
            return Response(
                {'error': f'Користувач {username} не знайдений'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Error creating chat: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        if not request.user.is_authenticated:
            raise AuthenticationFailed('User not authenticated')
            
        chat = self.get_object()
        content = request.data.get('content')
        
        if not content:
            return Response(
                {'error': 'Повідомлення не може бути порожнім'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            message = Message.objects.create(
                chat=chat,
                sender=request.user,
                content=content
            )

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{chat.id}",
                {
                    "type": "chat_message",
                    "id": message.id,
                    "message": message.content,
                    "sender": {"username": request.user.username},
                    "timestamp": message.created_at.isoformat(),
                },
            )

            for participant in chat.participants.all():
                if participant.id == request.user.id:
                    continue
                unread_count = unread_message_count_for_participant(chat.id, participant.id)
                async_to_sync(channel_layer.group_send)(
                    f"counter_{participant.id}",
                    build_counter_message_event(
                        chat_id=chat.id,
                        message_id=message.id,
                        message_text=message.content,
                        sender_username=request.user.username,
                        timestamp_iso=message.created_at.isoformat(),
                        unread_count=unread_count,
                    ),
                )

            serializer = MessageSerializer(message)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"Error sending message: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        chat = self.get_object()
        messages = chat.messages.all()
        return Response(MessageSerializer(messages, many=True).data)

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Отмечает чат как прочитанный пользователем"""
        if not request.user.is_authenticated:
            raise AuthenticationFailed('User not authenticated')
            
        chat = self.get_object()
        
        # Создаем или обновляем статус прочтения
        read_status, created = ChatReadStatus.objects.get_or_create(
            chat=chat,
            user=request.user,
            defaults={'last_read_at': timezone.now()}
        )
        
        if not created:
            # Обновляем время последнего прочтения
            read_status.last_read_at = timezone.now()
            read_status.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"counter_{request.user.id}",
            build_counter_read_reset_event(
                chat_id=chat.id,
                username=request.user.username,
                timestamp_iso=read_status.last_read_at.isoformat(),
            ),
        )

        return Response({
            'message': 'Чат отмечен как прочитанный',
            'last_read_at': read_status.last_read_at
        })

    def destroy(self, request, *args, **kwargs):
        chat = self.get_object()
        chat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)