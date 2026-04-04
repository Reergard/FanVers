"""
Самостійна зміна ролі (Читач → Перекладач → Літератор) через публічні POST endpoints.

У продакшені зазвичай вимкнено (ALLOW_USER_ROLE_SELF_PROMOTION=False), щоб роль
призначала лише адміністрація — інакше обхід обмеження на withdraw за роллю.
"""
from django.conf import settings

ROLE_SELF_PROMOTION_DISABLED_CODE = "ROLE_SELF_PROMOTION_DISABLED"
ROLE_SELF_PROMOTION_DISABLED_MESSAGE = (
    "Зміна ролі через сайт вимкнена. Зверніться до підтримки або адміністратора."
)


def is_role_self_promotion_allowed() -> bool:
    return bool(getattr(settings, "ALLOW_USER_ROLE_SELF_PROMOTION", False))
