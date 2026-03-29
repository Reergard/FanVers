"""Карусель «Тренди»: окремий рейтинг від ТОПу (динаміка за 7 днів, не day/week/month/all_time)."""

from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone

from apps.analytics_books.models import DailyAnalytics
from apps.catalog.models import Book

from .books_filter import books_eligible_for_trending
from .scoring import daily_row_score

# Мінімум за ітоговим trend_score (після всіх множників)
MIN_TREND_SCORE = 3.0

# Скільки книг віддає карусель (як у ТОПу за тижнем)
TRENDS_CAROUSEL_LIMIT = 9


def _maturity_bonus(age_days: int) -> float:
    if age_days <= 1:
        return 0.90
    if age_days == 2:
        return 1.00
    if age_days == 3:
        return 1.10
    if age_days == 4:
        return 1.16
    if age_days == 5:
        return 1.10
    if age_days == 6:
        return 1.00
    if 7 <= age_days <= 10:
        return 0.96
    return 1.00


def _consistency_bonus(active_days: int) -> float:
    if active_days <= 1:
        return 0.86
    if active_days == 2:
        return 0.94
    if active_days == 3:
        return 1.00
    if active_days == 4:
        return 1.06
    return 1.12


def _signal_bonus(signal_types: int) -> float:
    if signal_types <= 1:
        return 0.95
    if signal_types == 2:
        return 1.00
    if signal_types == 3:
        return 1.06
    return 1.10


def get_trend_books(limit: int | None = None) -> list[Book]:
    """
    Останні 7 календарних днів включно з сьогодні (d6…d0), trend_score за специфікацією продукту.
    """
    lim = TRENDS_CAROUSEL_LIMIT if limit is None else max(1, int(limit))

    allowed_ids = list(books_eligible_for_trending().values_list("id", flat=True))
    if not allowed_ids:
        return []

    today = timezone.now().date()
    start = today - timedelta(days=6)

    rows = DailyAnalytics.objects.filter(
        book_id__in=allowed_ids,
        date__gte=start,
        date__lte=today,
    ).select_related("book")

    by_key: dict[tuple[int, date], DailyAnalytics] = {}
    for r in rows:
        by_key[(r.book_id, r.date)] = r

    books = {
        b.pk: b
        for b in Book.objects.filter(pk__in=allowed_ids).select_related(
            "owner", "creator", "country"
        )
    }

    # d6 … d0 (від старого до сьогодні)
    dates = [today - timedelta(days=i) for i in range(6, -1, -1)]

    scored: list[tuple[Book, float, float, int]] = []

    for bid in allowed_ids:
        book = books.get(bid)
        if not book:
            continue

        daily_scores: list[int] = []
        daily_rows: list[DailyAnalytics | None] = []
        for d in dates:
            row = by_key.get((bid, d))
            if row:
                daily_scores.append(daily_row_score(row))
                daily_rows.append(row)
            else:
                daily_scores.append(0)
                daily_rows.append(None)

        d6, d5, d4, d3, d2, d1, d0 = daily_scores
        base = (
            d6 * 0.85
            + d5 * 0.95
            + d4 * 1.08
            + d3 * 1.15
            + d2 * 1.12
            + d1 * 1.00
            + d0 * 0.92
        )

        early = d6 + d5 + d4
        late = d2 + d1 + d0
        growth_ratio = (late + 1) / (early + 1)
        growth_bonus = max(0.90, min(1.18, growth_ratio))

        active_days = sum(1 for s in daily_scores if s >= 1)
        consistency_bonus = _consistency_bonus(active_days)

        peak_day = max(daily_scores) if daily_scores else 0
        week_total = sum(daily_scores)
        peak_share = peak_day / max(week_total, 1)
        if peak_share <= 0.55:
            spike_penalty = 1.00
        elif peak_share <= 0.70:
            spike_penalty = 0.92
        else:
            spike_penalty = 0.82

        week_views = sum((r.views if r else 0) for r in daily_rows)
        week_comments = sum((r.comments if r else 0) for r in daily_rows)
        week_br = sum((r.book_ratings if r else 0) for r in daily_rows)
        week_tr = sum((r.translation_ratings if r else 0) for r in daily_rows)
        week_cl = sum((r.comment_likes if r else 0) for r in daily_rows)
        week_bm = sum((r.bookmarks if r else 0) for r in daily_rows)

        signal_types = 0
        if week_views > 0:
            signal_types += 1
        if week_comments > 0:
            signal_types += 1
        if week_br + week_tr > 0:
            signal_types += 1
        if week_cl > 0:
            signal_types += 1
        if week_bm > 0:
            signal_types += 1

        signal_bonus = _signal_bonus(signal_types)

        created_at = getattr(book, "created_at", None)
        if created_at is None:
            # Імпорт/старі дані без дати — не ламати розрахунок; «доросла» книга за maturity
            age_days = 9999
        else:
            age_days = max(0, (today - created_at.date()).days)
        maturity_bonus = _maturity_bonus(age_days)

        trend_score = (
            base
            * growth_bonus
            * consistency_bonus
            * spike_penalty
            * signal_bonus
            * maturity_bonus
        )

        if trend_score < MIN_TREND_SCORE:
            continue

        scored.append((book, trend_score, float(late), active_days))

    scored.sort(
        key=lambda x: (
            -x[1],
            -x[2],
            -x[3],
            -x[0].pk,
        )
    )
    return [b for b, _, _, _ in scored[:lim]]
