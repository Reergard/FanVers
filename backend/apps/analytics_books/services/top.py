"""Вибірка книг для каруселі «ТОП» за періодом (TopBooksView)."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.analytics_books.models import BookAnalytics, DailyAnalytics
from apps.catalog.models import Book

from .books_filter import books_eligible_for_top
from .scoring import book_analytics_total_score, daily_row_score

# Мінімальна сума зважених подій за період (день/тиждень/місяць) і мінімум для all_time
# (≈ один новий BOOK-рейтинг у вазі `scoring.weighted_daily_score`).
MIN_TOP_SCORE_PERIOD = 3

VALID_PERIODS = frozenset({"day", "week", "month", "all_time"})


def _tie_break_key(book: Book, score: float) -> tuple:
    """Сортування: score ↓, свіжість ↓, стабільний id ↓."""
    lu = book.last_updated or book.created_at
    ts = lu.timestamp() if hasattr(lu, "timestamp") else 0
    return (-score, -ts, -book.pk)


def get_top_books(period: str, limit: int) -> list[Book]:
    if period not in VALID_PERIODS:
        raise ValueError("invalid_period")

    allowed_ids = set(books_eligible_for_top().values_list("id", flat=True))
    if not allowed_ids:
        return []

    today = timezone.now().date()
    scored: list[tuple[Book, float]] = []

    if period == "day":
        rows = DailyAnalytics.objects.filter(
            date=today, book_id__in=allowed_ids
        ).select_related("book")
        for d in rows:
            sc = daily_row_score(d)
            if sc < MIN_TOP_SCORE_PERIOD:
                continue
            scored.append((d.book, float(sc)))

    elif period == "week":
        start = today - timedelta(days=6)
        rows = DailyAnalytics.objects.filter(
            date__gte=start, book_id__in=allowed_ids
        ).select_related("book")
        by_book: dict[int, float] = {}
        book_by_id: dict[int, Book] = {}
        for d in rows:
            by_book[d.book_id] = by_book.get(d.book_id, 0) + daily_row_score(d)
            book_by_id[d.book_id] = d.book
        for bid, sc in by_book.items():
            if sc < MIN_TOP_SCORE_PERIOD:
                continue
            scored.append((book_by_id[bid], float(sc)))

    elif period == "month":
        start = today - timedelta(days=29)
        rows = DailyAnalytics.objects.filter(
            date__gte=start, book_id__in=allowed_ids
        ).select_related("book")
        by_book: dict[int, float] = {}
        book_by_id: dict[int, Book] = {}
        for d in rows:
            by_book[d.book_id] = by_book.get(d.book_id, 0) + daily_row_score(d)
            book_by_id[d.book_id] = d.book
        for bid, sc in by_book.items():
            if sc < MIN_TOP_SCORE_PERIOD:
                continue
            scored.append((book_by_id[bid], float(sc)))

    else:  # all_time
        bas = (
            BookAnalytics.objects.filter(book_id__in=allowed_ids)
            .select_related("book")
        )
        for a in bas:
            book = a.book
            total = float(book_analytics_total_score(a))
            if total < MIN_TOP_SCORE_PERIOD:
                continue
            scored.append((book, total))

    scored.sort(key=lambda x: _tie_break_key(x[0], x[1]))
    out = [b for b, _ in scored[:limit]]
    return out


def top_limit_for_period(period: str) -> int:
    return 15 if period == "all_time" else 9
