import logging

from django.contrib.auth import get_user_model
from rest_framework import serializers

from ..models import Chat, Message

User = get_user_model()
logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "profile_image"]

    def get_profile_image(self, obj):
        try:
            if hasattr(obj, "profile") and obj.profile.image:
                return obj.profile.image.url
        except Exception:
            logger.warning("UserSerializer.get_profile_image failed user_id=%s", getattr(obj, "pk", None), exc_info=True)
        return None


class ChatPartnerSearchSerializer(serializers.ModelSerializer):
    """Підказки для створення чату (частковий збіг)."""

    profile_username = serializers.CharField(
        source="profile.username", read_only=True, allow_null=True
    )
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "profile_username", "profile_image"]

    def get_profile_image(self, obj):
        try:
            if hasattr(obj, "profile") and obj.profile.image:
                return obj.profile.image.url
        except Exception:
            logger.warning(
                "ChatPartnerSearchSerializer.get_profile_image failed user_id=%s",
                getattr(obj, "pk", None),
                exc_info=True,
            )
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender", "content", "created_at"]


class ChatSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            "id",
            "participants",
            "created_at",
            "updated_at",
            "last_message",
            "unread_count",
        ]

    def get_last_message(self, obj):
        try:
            lm = getattr(obj, "last_message", None)
            if lm is None:
                return None
            return MessageSerializer(lm).data
        except Exception:
            logger.warning(
                "ChatSerializer.get_last_message failed chat_id=%s",
                getattr(obj, "pk", None),
                exc_info=True,
            )
            return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        bulk = self.context.get("unread_by_chat_id")
        if bulk is not None:
            return int(bulk.get(obj.id, 0))
        from ..unread_utils import unread_message_count_for_participant

        return unread_message_count_for_participant(obj.id, request.user.id)
