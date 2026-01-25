from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from ..models import Chat, Message, ChatReadStatus
from .serializers import ChatSerializer, MessageSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone

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
        print("List method called")
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
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
            
            if message:
                Message.objects.create(
                    chat=chat,
                    sender=request.user,
                    content=message
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
        
        return Response({
            'message': 'Чат отмечен как прочитанный',
            'last_read_at': read_status.last_read_at
        })

    def destroy(self, request, *args, **kwargs):
        chat = self.get_object()
        chat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)