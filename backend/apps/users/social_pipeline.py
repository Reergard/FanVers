from __future__ import annotations

from typing import Any


def activate_social_user(
    strategy: Any, details: dict[str, Any], user: Any = None, is_new: bool = False, *args: Any, **kwargs: Any
):
    """
    FanVers: по умолчанию User.is_active=False.

    Для social-auth (Google/Facebook) новый пользователь должен быть активным,
    иначе oauth_complete_redirect() остановит flow как "inactive".

    Важно: активируем только пользователей, созданных через social pipeline (is_new=True).
    """
    if not user or not is_new:
        return

    if getattr(user, "is_active", False):
        return

    user.is_active = True
    user.save(update_fields=["is_active"])

