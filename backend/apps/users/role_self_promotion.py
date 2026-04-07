"""
Самостійна зміна ролі через POST `become-translator` / `become-author`.

Глобального вимикача в settings немає — дозволені переходи задаються в `views`
за поточною роллю профілю.
"""


def is_role_self_promotion_allowed() -> bool:
    """Залишено для сумісності API (`role_self_promotion_allowed` у профілі / auth-status)."""
    return True
