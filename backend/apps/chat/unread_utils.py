"""Синхронний підрахунок непрочитаних повідомлень у чаті для учасника (як у ChatSerializer)."""

from .models import ChatReadStatus, Message


def unread_message_count_for_participant(chat_id: int, user_id: int) -> int:
    try:
        read_status = ChatReadStatus.objects.get(chat_id=chat_id, user_id=user_id)
        last_read_at = read_status.last_read_at
    except ChatReadStatus.DoesNotExist:
        last_read_at = None

    if last_read_at:
        return (
            Message.objects.filter(chat_id=chat_id, created_at__gt=last_read_at)
            .exclude(sender_id=user_id)
            .count()
        )
    return Message.objects.filter(chat_id=chat_id).exclude(sender_id=user_id).count()
