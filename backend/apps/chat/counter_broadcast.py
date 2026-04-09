"""Події WebSocket `counter_*` для синхронізації бейджів непрочитаних."""


def build_counter_message_event(
    *,
    chat_id: int,
    message_id,
    message_text: str,
    sender_username: str,
    timestamp_iso: str,
    unread_count: int,
):
    return {
        "type": "counter_update",
        "id": message_id,
        "preview": (message_text or "")[:50],
        "sender": {"username": sender_username},
        "timestamp": timestamp_iso,
        "chat_id": chat_id,
        "unread_count": unread_count,
    }


def build_counter_read_reset_event(*, chat_id: int, username: str, timestamp_iso: str):
    return {
        "type": "counter_update",
        "id": None,
        "message": "",
        "sender": {"username": username},
        "timestamp": timestamp_iso,
        "chat_id": chat_id,
        "unread_count": 0,
    }
