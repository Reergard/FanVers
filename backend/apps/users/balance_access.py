"""
Єдине правило: хто може ініціювати виведення балансу через публічний API.

Не перевіряє баланс, доходи чи наявність книг — лише роль профілю.
Адмінка та внутрішні операції цим модулем не обмежуються.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.users.models import Profile

# Лише значення з choices у Profile.role (укр.). strip() — лише від пробілів у БД.
WITHDRAW_ELIGIBLE_PROFILE_ROLES = frozenset({"Перекладач", "Літератор"})

# Єдині текст і код відмови для withdraw (view — основне місце; serializer — та сама константа).
API_WITHDRAW_ROLE_FORBIDDEN_CODE = "WITHDRAW_ROLE_FORBIDDEN"
API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE = (
    "Виведення коштів доступне лише для перекладачів та літераторів"
)


def profile_can_request_balance_withdraw(profile: Profile | None) -> bool:
    if profile is None:
        return False
    role = (profile.role or "").strip()
    return role in WITHDRAW_ELIGIBLE_PROFILE_ROLES
