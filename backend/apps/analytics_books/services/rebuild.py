"""
Перерахунок BookAnalytics і DailyAnalytics з джерел правди (перегляди, коментарі,
закладки, рейтинги, лайки коментарів).

DailyAnalytics.comment_likes за день береться лише з сумми CommentLikeAnalyticsEvent за цей день;
якщо подій не було — 0 (старі помилкові значення в рядку не зберігаються).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Iterable

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from apps.analytics_books.models import (
    BookAnalytics,
    CommentLikeAnalyticsEvent,
    DailyAnalytics,
)
from apps.catalog.models import Book
from apps.monitoring.models import BookView
from apps.navigation.models import Bookmark
from apps.rating.models import BookRating
from apps.reviews.models import BookComment, ChapterComment


def _merge_counts(*dicts: dict[int, int]) -> set[int]:
    keys: set[int] = set()
    for d in dicts:
        keys |= set(d.keys())
    return keys


def _comment_likes_per_book() -> dict[int, int]:
    bc = (
        BookComment.likes.through.objects.values("bookcomment__book_id")
        .annotate(c=Count("id"))
    )
    cc = (
        ChapterComment.likes.through.objects.values(
            "chaptercomment__chapter__book_id"
        ).annotate(c=Count("id"))
    )
    out: dict[int, int] = defaultdict(int)
    for row in bc:
        bid = row["bookcomment__book_id"]
        if bid is not None:
            out[bid] += row["c"]
    for row in cc:
        bid = row["chaptercomment__chapter__book_id"]
        if bid is not None:
            out[bid] += row["c"]
    return dict(out)


def _comments_per_book() -> dict[int, int]:
    bc = dict(
        BookComment.objects.values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    cc_raw = ChapterComment.objects.values("chapter__book_id").annotate(c=Count("id"))
    cc = {row["chapter__book_id"]: row["c"] for row in cc_raw}
    out: dict[int, int] = defaultdict(int)
    for bid, c in bc.items():
        out[bid] += c
    for bid, c in cc.items():
        out[bid] += c
    return dict(out)


def recompute_book_analytics_totals(book_ids: Iterable[int] | None = None) -> int:
    """
    Повністю перезаписує агрегати BookAnalytics з таблиць-моделей.
    Повертає кількість оброблених book_id.
    """
    views = dict(
        BookView.objects.values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    comments = _comments_per_book()
    bookmarks = dict(
        Bookmark.objects.values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    book_ratings = dict(
        BookRating.objects.filter(rating_type="BOOK")
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    translation_ratings = dict(
        BookRating.objects.filter(rating_type="TRANSLATION")
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    comment_likes = _comment_likes_per_book()

    tracked = _merge_counts(
        views,
        comments,
        bookmarks,
        book_ratings,
        translation_ratings,
        comment_likes,
    )
    tracked |= set(
        BookAnalytics.objects.values_list("book_id", flat=True).distinct()
    )
    if book_ids is not None:
        wanted = set(book_ids)
        tracked = tracked & wanted
        if not tracked:
            return 0

    tracked = set(
        Book.objects.filter(pk__in=tracked).values_list("pk", flat=True)
    )
    if not tracked:
        return 0

    existing = {
        b.book_id: b
        for b in BookAnalytics.objects.filter(book_id__in=tracked)
    }
    to_create: list[BookAnalytics] = []
    to_update: list[BookAnalytics] = []
    fields = [
        "views_count",
        "comments_count",
        "bookmarks_count",
        "book_ratings_count",
        "translation_ratings_count",
        "comment_likes_count",
    ]

    for bid in tracked:
        payload = {
            "views_count": views.get(bid, 0),
            "comments_count": comments.get(bid, 0),
            "bookmarks_count": bookmarks.get(bid, 0),
            "book_ratings_count": book_ratings.get(bid, 0),
            "translation_ratings_count": translation_ratings.get(bid, 0),
            "comment_likes_count": comment_likes.get(bid, 0),
        }
        if bid in existing:
            obj = existing[bid]
            for k, v in payload.items():
                setattr(obj, k, v)
            to_update.append(obj)
        else:
            to_create.append(BookAnalytics(book_id=bid, **payload))

    with transaction.atomic():
        if to_create:
            BookAnalytics.objects.bulk_create(to_create, batch_size=500)
        if to_update:
            BookAnalytics.objects.bulk_update(to_update, fields=fields, batch_size=500)

    return len(tracked)


def rebuild_daily_analytics_for_date(d: date) -> int:
    """
    Відновлює за календарний день усі поля DailyAnalytics.
    comment_likes = сума подій за день або 0 (джерело правди — CommentLikeAnalyticsEvent).
    """
    views = dict(
        BookView.objects.filter(viewed_at__date=d)
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    bc = dict(
        BookComment.objects.filter(created_at__date=d)
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    cc_raw = (
        ChapterComment.objects.filter(created_at__date=d)
        .values("chapter__book_id")
        .annotate(c=Count("id"))
    )
    cc = {row["chapter__book_id"]: row["c"] for row in cc_raw}
    comments_d: dict[int, int] = defaultdict(int)
    for bid, c in bc.items():
        comments_d[bid] += c
    for bid, c in cc.items():
        comments_d[bid] += c
    comments_d = dict(comments_d)

    bookmarks = dict(
        Bookmark.objects.filter(created_at__date=d)
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    br_book = dict(
        BookRating.objects.filter(created_at__date=d, rating_type="BOOK")
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )
    br_tr = dict(
        BookRating.objects.filter(created_at__date=d, rating_type="TRANSLATION")
        .values("book_id")
        .annotate(c=Count("id"))
        .values_list("book_id", "c")
    )

    likes_raw = (
        CommentLikeAnalyticsEvent.objects.filter(day=d)
        .values("book_id")
        .annotate(c=Sum("delta"))
    )
    comment_likes_d = {
        row["book_id"]: max(0, int(row["c"] or 0)) for row in likes_raw
    }

    existing_daily = {
        row.book_id: row
        for row in DailyAnalytics.objects.filter(date=d).only(
            "book_id", "comment_likes"
        )
    }
    existing_ids = set(existing_daily.keys())
    all_ids = (
        _merge_counts(views, comments_d, bookmarks, br_book, br_tr)
        | set(comment_likes_d.keys())
        | existing_ids
    )
    valid_ids = set(
        Book.objects.filter(pk__in=all_ids).values_list("pk", flat=True)
    )

    n = 0
    with transaction.atomic():
        for bid in valid_ids:
            cl_val = comment_likes_d.get(bid, 0)

            DailyAnalytics.objects.update_or_create(
                book_id=bid,
                date=d,
                defaults={
                    "views": views.get(bid, 0),
                    "comments": comments_d.get(bid, 0),
                    "bookmarks": bookmarks.get(bid, 0),
                    "book_ratings": br_book.get(bid, 0),
                    "translation_ratings": br_tr.get(bid, 0),
                    "comment_likes": cl_val,
                },
            )
            n += 1
    return n


def rebuild_daily_analytics_last_days(days: int) -> dict[str, int]:
    """Перебудова денних рядків за останні `days` календарних днів (включно з сьогодні)."""
    today = timezone.now().date()
    total_rows = 0
    for i in range(days):
        total_rows += rebuild_daily_analytics_for_date(today - timedelta(days=i))
    return {"days": days, "update_or_create_calls": total_rows}


def run_full_analytics_repair(*, days: int = 90, book_ids: Iterable[int] | None = None) -> dict:
    """
    Повний цикл: суми BookAnalytics + денні рядки за вікно.
    """
    n_books = recompute_book_analytics_totals(book_ids=book_ids)
    daily_stats = rebuild_daily_analytics_last_days(days)
    return {"book_analytics_books": n_books, **daily_stats}
