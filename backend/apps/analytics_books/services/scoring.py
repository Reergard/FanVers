"""Єдина формула «очків» для ТОПу за періодом та інших агрегатів (денна агрегація та all-time)."""

from __future__ import annotations

from apps.analytics_books.models import BookAnalytics, DailyAnalytics


def weighted_daily_score(
    views: int,
    comments: int,
    book_ratings: int,
    translation_ratings: int,
    comment_likes: int,
    bookmarks: int,
) -> int:
    return (
        views
        + comments * 2
        + book_ratings * 3
        + translation_ratings * 3
        + comment_likes
        + bookmarks * 4
    )


def daily_row_score(d: DailyAnalytics) -> int:
    return weighted_daily_score(
        d.views,
        d.comments,
        d.book_ratings,
        d.translation_ratings,
        d.comment_likes,
        d.bookmarks,
    )


def weighted_totals_for_period_dict(totals: dict) -> int:
    """
    Сирі суми за період (ключі як у `DailyAnalytics.get_analytics_for_period`) →
    ті самі зважені очки, що для ТОПу за періодом.
    """
    return weighted_daily_score(
        int(totals.get("views") or 0),
        int(totals.get("comments") or 0),
        int(totals.get("book_ratings") or 0),
        int(totals.get("translation_ratings") or 0),
        int(totals.get("comment_likes") or 0),
        int(totals.get("bookmarks") or 0),
    )


def book_analytics_total_score(a: BookAnalytics) -> int:
    return weighted_daily_score(
        a.views_count,
        a.comments_count,
        a.book_ratings_count,
        a.translation_ratings_count,
        a.comment_likes_count,
        a.bookmarks_count,
    )
