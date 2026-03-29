from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg
from django.http import Http404
from ..models import BookRating
from .serializers import BookRatingSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from apps.catalog.models import Book
from django.db import models
from apps.catalog.api.permissions import check_book_access_permission

from ..domain import (
    available_rating_types,
    compute_overall_rating,
    translation_rating_applicable,
)


class BookRatingViewSet(viewsets.ModelViewSet):
    serializer_class = BookRatingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """
        Разрешаем чтение рейтингов для всех (гости могут видеть рейтинги),
        но требуем авторизацию для создания/изменения/удаления
        """
        if self.action in ['book_ratings', 'list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        return BookRating.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            # Перевіряємо права доступу до оцінювання книги
            book_slug = request.data.get('book_slug')
            if book_slug:
                book = get_object_or_404(Book, slug=book_slug)
                
                is_allowed, error_message = check_book_access_permission(
                    request.user, book, 'rate'
                )
                
                if not is_allowed:
                    return Response(
                        {'error': error_message}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Http404:
            raise
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_destroy(self, instance):
        from apps.analytics_books.services.analytics_counters import (
            record_book_rating_removed,
            record_translation_rating_removed,
        )

        book = instance.book
        rt = instance.rating_type
        super().perform_destroy(instance)
        if rt == "BOOK":
            record_book_rating_removed(book)
        else:
            record_translation_rating_removed(book)

    @action(
        detail=False, 
        methods=['GET'],
        url_path=r'(?P<book_slug>[^/.]+)/book-ratings'
    )
    def book_ratings(self, request, book_slug=None):
        try:
            book_slug = book_slug or request.query_params.get('book_slug')
            if not book_slug:
                return Response(
                    {'error': 'Book slug is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            book = get_object_or_404(Book, slug=book_slug)

            ratings = BookRating.objects.filter(book=book)

            book_ratings = ratings.filter(rating_type="BOOK")
            book_rating_stats = book_ratings.aggregate(
                avg_rating=Avg("rating"),
                total_votes=models.Count("id"),
            )

            b_avg = book_rating_stats["avg_rating"]
            b_avg_f = float(b_avg) if b_avg is not None else 0.0

            show_translation = translation_rating_applicable(book.book_type)
            translation_payload = None
            t_avg_f = None

            if show_translation:
                translation_qs = ratings.filter(rating_type="TRANSLATION")
                translation_rating_stats = translation_qs.aggregate(
                    avg_rating=Avg("rating"),
                    total_votes=models.Count("id"),
                )
                t_avg = translation_rating_stats["avg_rating"]
                t_avg_f = float(t_avg) if t_avg is not None else 0.0
                translation_payload = {
                    "average": t_avg_f,
                    "total_votes": translation_rating_stats["total_votes"],
                }

            user_ratings = None
            if request.user.is_authenticated:
                ur = ratings.filter(user=request.user).values("rating_type", "rating")
                allowed = set(available_rating_types(book.book_type))
                user_ratings = [
                    row for row in ur if row["rating_type"] in allowed
                ]

            overall = compute_overall_rating(
                book.book_type,
                b_avg_f if book_rating_stats["total_votes"] else None,
                t_avg_f if show_translation else None,
            )

            return Response(
                {
                    "book_type": book.book_type,
                    "available_rating_types": available_rating_types(book.book_type),
                    "has_translation_rating": show_translation,
                    "overall_rating": overall,
                    "book_rating": {
                        "average": b_avg_f,
                        "total_votes": book_rating_stats["total_votes"],
                    },
                    "translation_rating": translation_payload,
                    "user_ratings": user_ratings if user_ratings else None,
                }
            )
        except Http404:
            raise
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )