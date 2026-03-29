import logging

from django.db.models import Case, IntegerField, When
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.api.serializers import BookReaderSerializer
from apps.catalog.models import Book

from ..services.analytics_counters import (
    record_book_rating_created,
    record_book_rating_removed,
    record_bookmark_added,
    record_bookmark_removed,
    record_comment_created,
    record_comment_deleted,
    record_comment_like_added,
    record_comment_like_removed,
    record_translation_rating_created,
    record_translation_rating_removed,
    record_unique_book_view_from_request,
)
from ..services.top import (
    VALID_PERIODS,
    get_top_books,
    top_limit_for_period,
)
from ..services.trends import get_trend_books
from .serializers import TrendCarouselBookSerializer

logger = logging.getLogger(__name__)

_ALLOWED_UPDATE_ACTIONS = frozenset(
    {
        "view",
        "comment",
        "comment_removed",
        "book_rating",
        "book_rating_removed",
        "translation_rating",
        "translation_rating_removed",
        "comment_like",
        "comment_like_removed",
        "bookmark",
        "bookmark_removed",
    }
)


class TopBooksView(APIView):
    """GET: ТОП книг за періодом (зважена активність з аналітики). Не плутати з майбутніми «Трендами»."""

    def get(self, request):
        raw_type = request.query_params.get("type", "day")
        if raw_type not in VALID_PERIODS:
            return Response(
                {
                    "error": "Invalid type. Allowed: day, week, month, all_time.",
                    "allowed": sorted(VALID_PERIODS),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = top_limit_for_period(raw_type)
        try:
            ordered = get_top_books(raw_type, limit)
        except ValueError:
            return Response(
                {"error": "Invalid type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ordered:
            return Response([])

        ids = [b.pk for b in ordered]
        preserved = Case(
            *[When(pk=uid, then=pos) for pos, uid in enumerate(ids)],
            output_field=IntegerField(),
        )
        books_qs = (
            Book.objects.filter(pk__in=ids)
            .select_related("owner", "creator", "country")
            .prefetch_related("genres", "tags", "fandoms")
            .order_by(preserved)
        )

        serializer = BookReaderSerializer(
            list(books_qs),
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class TrendsBooksView(APIView):
    """GET: карусель «Тренди» (7 днів, окремий trend_score; не ТОП за періодом)."""

    def get(self, request):
        ordered = get_trend_books()
        if not ordered:
            return Response([])

        ids = [b.pk for b in ordered]
        preserved = Case(
            *[When(pk=uid, then=pos) for pos, uid in enumerate(ids)],
            output_field=IntegerField(),
        )
        books_qs = (
            Book.objects.filter(pk__in=ids)
            .select_related("owner", "creator", "country")
            .prefetch_related("genres", "tags", "fandoms")
            .order_by(preserved)
        )

        serializer = TrendCarouselBookSerializer(
            list(books_qs),
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class UpdateAnalyticsView(APIView):
    """
    Тимчасова сумісність зі старими клієнтами. Не використовувати для нових фіч:
    усі метрики мають оновлюватися з місць реальних дій (див. analytics_counters).
    Для action_type=view — та сама унікальність, що в register_book_view.
    """

    def post(self, request):
        book_id_or_slug = request.data.get("book_id")
        action_type = request.data.get("action_type")

        if not book_id_or_slug or not action_type:
            return Response(
                {"error": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action_type not in _ALLOWED_UPDATE_ACTIONS:
            return Response(
                {"error": "Invalid action type", "allowed": sorted(_ALLOWED_UPDATE_ACTIONS)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if str(book_id_or_slug).isdigit():
                book = Book.objects.get(id=int(book_id_or_slug))
            else:
                book = Book.objects.get(slug=book_id_or_slug)
        except Book.DoesNotExist:
            return Response(
                {"error": "Book not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action_type == "view":
            counted = record_unique_book_view_from_request(request, book)
            return Response({"status": "success", "counted": counted})

        if action_type in ("translation_rating", "translation_rating_removed"):
            if book.book_type == "AUTHOR":
                return Response(
                    {
                        "error": "Оцінка перекладу недоступна для авторських книг.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if action_type == "comment":
            record_comment_created(book)
        elif action_type == "comment_removed":
            record_comment_deleted(book)
        elif action_type == "book_rating":
            record_book_rating_created(book)
        elif action_type == "book_rating_removed":
            record_book_rating_removed(book)
        elif action_type == "translation_rating":
            record_translation_rating_created(book)
        elif action_type == "translation_rating_removed":
            record_translation_rating_removed(book)
        elif action_type == "comment_like":
            record_comment_like_added(book)
        elif action_type == "comment_like_removed":
            record_comment_like_removed(book)
        elif action_type == "bookmark":
            record_bookmark_added(book)
        elif action_type == "bookmark_removed":
            record_bookmark_removed(book)

        return Response({"status": "success"})
