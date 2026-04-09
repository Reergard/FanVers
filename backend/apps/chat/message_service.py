"""Єдине місце: створення повідомлення, оновлення чату, WS-розсилка (REST + WebSocket)."""

import logging
from typing import TYPE_CHECKING

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

from .counter_broadcast import build_counter_message_event
from .unread_utils import unread_message_count_for_participant

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

    from .models import Message

logger = logging.getLogger(__name__)


def _broadcast_after_commit(message: "Message") -> None:
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning("create_chat_message: channel_layer is None, skip WS broadcast")
        return

    chat_id = message.chat_id
    sender = message.sender
    try:
        async_to_sync(channel_layer.group_send)(
            f"chat_{chat_id}",
            {
                "type": "chat_message",
                "id": message.id,
                "message": message.content,
                "sender": {"username": sender.username},
                "timestamp": message.created_at.isoformat(),
            },
        )
    except Exception:
        logger.exception("broadcast chat_message failed chat_id=%s", chat_id)

    try:
        participants = list(message.chat.participants.all())
    except Exception:
        logger.exception("load participants for counters chat_id=%s", chat_id)
        return

    for participant in participants:
        if participant.id == sender.id:
            continue
        try:
            unread_count = unread_message_count_for_participant(chat_id, participant.id)
            async_to_sync(channel_layer.group_send)(
                f"counter_{participant.id}",
                build_counter_message_event(
                    chat_id=chat_id,
                    message_id=message.id,
                    message_text=message.content,
                    sender_username=sender.username,
                    timestamp_iso=message.created_at.isoformat(),
                    unread_count=unread_count,
                ),
            )
        except Exception:
            logger.exception(
                "broadcast counter failed chat_id=%s participant_id=%s",
                chat_id,
                participant.id,
            )


def create_chat_message(*, chat_id: int, sender: "AbstractUser", content: str) -> "Message":
    """
    Зберігає Message, оновлює Chat.last_message та Chat.updated_at, після commit — WS.
    """
    from .models import Chat, Message

    text = (content or "").strip()
    if not text:
        raise ValueError("empty message")
    if len(text) > 5000:
        raise ValueError("message too long")

    with transaction.atomic():
        chat = Chat.objects.select_for_update().get(pk=chat_id)
        if not chat.participants.filter(pk=sender.pk).exists():
            raise PermissionError("not a chat participant")
        msg = Message.objects.create(chat=chat, sender=sender, content=text)
        now = timezone.now()
        Chat.objects.filter(pk=chat_id).update(last_message_id=msg.id, updated_at=now)

        def _on_commit():
            from .models import Message as M

            fresh = (
                M.objects.select_related("sender", "chat")
                .filter(pk=msg.pk)
                .first()
            )
            if fresh:
                _broadcast_after_commit(fresh)

        transaction.on_commit(_on_commit)

    return (
        Message.objects.select_related("sender__profile")
        .filter(pk=msg.pk)
        .first()
        or msg
    )
