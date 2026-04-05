from rest_framework import serializers
from django.contrib.auth import get_user_model

from ..models import Chat, ChatReadStatus, Message

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
        # Meta.fields: last_message перед unread_count — list() прогріває prefetch-кеш для get_unread_count
        messages = obj.messages.all()
        msg_list = list(messages)
        if not msg_list:
            return None
        return MessageSerializer(msg_list[-1]).data

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0

        uid = request.user.id
        user_read_statuses = getattr(obj, "user_read_statuses", None)

        if user_read_statuses is not None:
            last_read_at = user_read_statuses[0].last_read_at if user_read_statuses else None
        else:
            try:
                last_read_at = ChatReadStatus.objects.get(chat=obj, user_id=uid).last_read_at
            except ChatReadStatus.DoesNotExist:
                last_read_at = None

        messages = obj.messages.all()
        if last_read_at:
            return sum(1 for m in messages if m.sender_id != uid and m.created_at > last_read_at)
        return sum(1 for m in messages if m.sender_id != uid)