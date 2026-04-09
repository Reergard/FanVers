"""Синхронний підрахунок непрочитаних повідомлень у чаті для учасника."""

from django.db.models import Count, DateTimeField, F, OuterRef, Q, Subquery

from .models import ChatReadStatus, Message


def unread_counts_for_user_in_chats(chat_ids: list[int], user_id: int) -> dict[int, int]:
    """
    Один ORM-запит (values + annotate): непрочитані по кожному чату.
    Умова: немає ChatReadStatus для пари (chat, user) або created_at > last_read_at.
    """
    if not chat_ids:
        return {}

    last_read_sq = Subquery(
        ChatReadStatus.objects.filter(
            chat_id=OuterRef("chat_id"),
            user_id=user_id,
        ).values("last_read_at")[:1],
        output_field=DateTimeField(null=True),
    )

    rows = (
        Message.objects.filter(chat_id__in=chat_ids)
        .exclude(sender_id=user_id)
        .annotate(_lr_at=last_read_sq)
        .filter(Q(_lr_at__isnull=True) | Q(created_at__gt=F("_lr_at")))
        .values("chat_id")
        .order_by()
        .annotate(cnt=Count("id"))
    )

    return {int(row["chat_id"]): int(row["cnt"]) for row in rows}


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
