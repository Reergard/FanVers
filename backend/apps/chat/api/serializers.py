from rest_framework import serializers
from ..models import Chat, Message
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile_image']
    
    def get_profile_image(self, obj):
        if hasattr(obj, 'profile') and obj.profile.image:
            return obj.profile.image.url
        return None

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'content', 'created_at']

class ChatSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ['id', 'participants', 'created_at', 'updated_at', 'last_message', 'unread_count']

    def get_last_message(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            return MessageSerializer(last_message).data
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from django.db.models import Q
            from ..models import ChatReadStatus
            
            # Получаем время последнего прочтения чата пользователем
            try:
                read_status = ChatReadStatus.objects.get(chat=obj, user=request.user)
                last_read_at = read_status.last_read_at
            except ChatReadStatus.DoesNotExist:
                # Если пользователь никогда не открывал чат, считаем все сообщения от других непрочитанными
                last_read_at = None
            
            if last_read_at:
                # Считаем сообщения от других пользователей, созданные ПОСЛЕ последнего прочтения
                unread_count = obj.messages.filter(
                    ~Q(sender=request.user),
                    created_at__gt=last_read_at
                ).count()
            else:
                # Если пользователь никогда не открывал чат, считаем все сообщения от других
                unread_count = obj.messages.filter(
                    ~Q(sender=request.user)
                ).count()
            
            return unread_count
        return 0