from apps.catalog.api.serializers import BookReaderSerializer


class TrendCarouselBookSerializer(BookReaderSerializer):
    """Карточка книги для GET /api/analytics_books/trends/ (той самий JSON, що й ТОП, окремий контракт)."""

    class Meta(BookReaderSerializer.Meta):
        pass
