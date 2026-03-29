"""Єдина формула «очків» для ТОПу за періодом та інших агрегатів (денна агрегація та all-time)."""

from __future__ import annotations

from apps.analytics_books.models import BookAnalytics, DailyAnalytics


def _scoring_book_type(book) -> str:
    """Тільки AUTHOR / TRANSLATION; інакше — як у моделі Book за замовчуванням (TRANSLATION)."""
    bt = getattr(book, "book_type", None)
    if bt == "AUTHOR":
        return "AUTHOR"
    if bt == "TRANSLATION":
        return "TRANSLATION"
    return "TRANSLATION"


def weighted_daily_score(
    views: int,
    comments: int,
    book_ratings: int,
    translation_ratings: int,
    comment_likes: int,
    bookmarks: int,
    *,
    book_type: str = "TRANSLATION",
) -> int:
    """
    Зважені «очки» активності. Для AUTHOR один допустимий тип рейтингу (BOOK) дає
    той самий сумарний рейтинговий потенціал, що два типи у перекладу:
    AUTHOR: book_ratings * 6; TRANSLATION: book_ratings * 3 + translation_ratings * 3.
    """
    base = views + comments * 2 + comment_likes + bookmarks * 4
    if book_type == "AUTHOR":
        return base + book_ratings * 6
    return base + book_ratings * 3 + translation_ratings * 3


def daily_row_score(d: DailyAnalytics) -> int:
    bt = _scoring_book_type(d.book)
    return weighted_daily_score(
        d.views,
        d.comments,
        d.book_ratings,
        d.translation_ratings,
        d.comment_likes,
        d.bookmarks,
        book_type=bt,
    )


def weighted_totals_for_period_dict(totals: dict, *, book_type: str = "TRANSLATION") -> int:
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
        book_type=book_type,
    )


def book_analytics_total_score(a: BookAnalytics) -> int:
    bt = _scoring_book_type(a.book)
    return weighted_daily_score(
        a.views_count,
        a.comments_count,
        a.book_ratings_count,
        a.translation_ratings_count,
        a.comment_likes_count,
        a.bookmarks_count,
        book_type=bt,
    )
