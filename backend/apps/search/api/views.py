from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.catalog.models import Book
from apps.catalog.api.serializers import BookReaderSerializer
from apps.search.filters import BookFilter


class BookSearchView(generics.ListAPIView):
    serializer_class = BookReaderSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_class = BookFilter

    def get_queryset(self):
        # Базовый queryset с аннотацией количества глав.
        # Фильтрация применяется стандартно через filter_backends в ListAPIView.
        queryset = Book.objects.annotate(chapter_count=Count('chapters'))

        user = getattr(self.request, "user", None)
        if not user or user.is_anonymous:
            return queryset.filter(adult_content=False)

        # Server-side enforcement: users who chose to hide adult content
        # must never receive adult_content=True regardless of filter params.
        try:
            if user.profile.hide_adult_content:
                return queryset.filter(adult_content=False)
        except Exception:
            # If profile is missing/unavailable, fail closed for safety.
            return queryset.filter(adult_content=False)

        return queryset

