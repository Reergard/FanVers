"""
Атомарні зміни лічильників аналітики (F-вирази).
Викликати з місць, де дія вже відбулась у БД (коментар, закладка, рейтинг, перегляд).
"""

from __future__ import annotations

from typing import Any

from django.db.models import F
from django.db.models.functions import Greatest
from django.utils import timezone

from apps.analytics_books.models import (
    BookAnalytics,
    CommentLikeAnalyticsEvent,
    DailyAnalytics,
)
from apps.catalog.models import Book
from apps.monitoring.models import BookView

def _ensure_rows(book: Book) -> tuple[BookAnalytics, DailyAnalytics]:
    ba, _ = BookAnalytics.objects.get_or_create(book=book)
    da, _ = DailyAnalytics.objects.get_or_create(book=book, date=timezone.now().date())
    return ba, da


def adjust_book_analytics(
    book: Book,
    *,
    views: int = 0,
    comments: int = 0,
    book_ratings: int = 0,
    translation_ratings: int = 0,
    comment_likes: int = 0,
    bookmarks: int = 0,
) -> None:
    """Дельти можуть бути від'ємними; лічильники не опускаються нижче 0."""
    deltas = {
        "views_count": views,
        "comments_count": comments,
        "book_ratings_count": book_ratings,
        "translation_ratings_count": translation_ratings,
        "comment_likes_count": comment_likes,
        "bookmarks_count": bookmarks,
    }
    daily_keys = {
        "views_count": "views",
        "comments_count": "comments",
        "book_ratings_count": "book_ratings",
        "translation_ratings_count": "translation_ratings",
        "comment_likes_count": "comment_likes",
        "bookmarks_count": "bookmarks",
    }

    _ensure_rows(book)
    book_id = book.pk

    ba_updates: dict[str, Any] = {}
    da_updates: dict[str, Any] = {}
    for ba_field, delta in deltas.items():
        if delta == 0:
            continue
        da_field = daily_keys[ba_field]
        if delta > 0:
            ba_updates[ba_field] = F(ba_field) + delta
            da_updates[da_field] = F(da_field) + delta
        else:
            ba_updates[ba_field] = Greatest(F(ba_field) + delta, 0)
            da_updates[da_field] = Greatest(F(da_field) + delta, 0)

    if ba_updates:
        BookAnalytics.objects.filter(book_id=book_id).update(**ba_updates)
    if da_updates:
        DailyAnalytics.objects.filter(book_id=book_id, date=timezone.now().date()).update(
            **da_updates
        )


def record_unique_book_view_from_request(request, book: Book) -> bool:
    """
    Один зарахований перегляд на користувача на календарний день (BookView + аналітика).

    Політика продукту: лише **авторизовані** користувачі (у BookView обов’язковий user).
    Перегляди гостей свідомо **не** входять у зважені метрики ТОПу — інакше потрібні session/ip + міграція моделі.
    Повертає True, якщо перегляд зараховано.
    """
    if not request.user.is_authenticated:
        return False

    today = timezone.now().date()
    exists = BookView.objects.filter(
        user=request.user, book=book, viewed_at__date=today
    ).exists()
    if exists:
        return False

    BookView.objects.create(
        user=request.user,
        book=book,
        ip_address=request.META.get("REMOTE_ADDR"),
    )
    adjust_book_analytics(book, views=1)
    return True


def record_comment_created(book: Book) -> None:
    adjust_book_analytics(book, comments=1)


def record_comment_deleted(book: Book) -> None:
    adjust_book_analytics(book, comments=-1)


def record_bookmark_added(book: Book) -> None:
    adjust_book_analytics(book, bookmarks=1)


def record_bookmark_removed(book: Book) -> None:
    adjust_book_analytics(book, bookmarks=-1)


def _append_comment_like_event(book: Book, delta: int) -> None:
    if delta == 0:
        return
    CommentLikeAnalyticsEvent.objects.create(
        book=book, day=timezone.now().date(), delta=delta
    )


def record_comment_like_added(book: Book) -> None:
    _append_comment_like_event(book, 1)
    adjust_book_analytics(book, comment_likes=1)


def record_comment_like_removed(book: Book) -> None:
    _append_comment_like_event(book, -1)
    adjust_book_analytics(book, comment_likes=-1)


def record_book_rating_created(book: Book) -> None:
    adjust_book_analytics(book, book_ratings=1)


def record_book_rating_removed(book: Book) -> None:
    adjust_book_analytics(book, book_ratings=-1)


def record_translation_rating_created(book: Book) -> None:
    adjust_book_analytics(book, translation_ratings=1)


def record_translation_rating_removed(book: Book) -> None:
    adjust_book_analytics(book, translation_ratings=-1)
