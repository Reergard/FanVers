import logging

logger = logging.getLogger(__name__)


def broadcast_user_ws_disconnect(user_id: int) -> None:
    """Сигнал усім WS-з'єднанням користувача закритися (наприклад після logout)."""
    if not user_id:
        return
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {"type": "force.disconnect"},
        )
    except Exception:
        logger.exception("broadcast_user_ws_disconnect failed for user_id=%s", user_id)
