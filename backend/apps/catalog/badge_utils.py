"""Єдине правило для UI-бейджа «новинка» на картках книг."""
from datetime import timedelta

from django.utils import timezone

NEW_BADGE_DAYS = 7


def book_shows_new_badge(obj) -> bool:
    """True, якщо книгу варто позначати як новинку (за датою створення)."""
    created = getattr(obj, "created_at", None)
    if not created:
        return False
    if timezone.is_naive(created):
        created = timezone.make_aware(created, timezone.get_current_timezone())
    return created >= timezone.now() - timedelta(days=NEW_BADGE_DAYS)
