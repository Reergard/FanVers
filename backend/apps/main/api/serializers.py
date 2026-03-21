from rest_framework import serializers
from apps.catalog.models import Book
import logging

logger = logging.getLogger(__name__)


class HomeBookCardSerializer(serializers.ModelSerializer):
    """
    Картка книги для головної (новинки / останні оновлення).
    chapters_count та latest_chapter_title мають бути передані з queryset через .annotate() —
    без N+1 на кожну книгу.
    """

    background_image = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    # Не називати annotate як chapters_count — на Book є @property chapters_count без setter.
    chapters_count = serializers.IntegerField(read_only=True, source="home_chapters_total")
    latest_chapter_title = serializers.CharField(read_only=True, allow_null=True)
    genres = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    fandoms = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "description",
            "image",
            "slug",
            "background_image",
            "cover_image",
            "created_at",
            "book_type",
            "adult_content",
            "chapters_count",
            "latest_chapter_title",
            "genres",
            "tags",
            "fandoms",
        ]

    def get_background_image(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

    def get_cover_image(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

    def get_genres(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.genres.all()]

    def get_tags(self, obj):
        return [{"id": t.id, "name": t.name} for t in obj.tags.all()]

    def get_fandoms(self, obj):
        return [{"id": f.id, "name": f.name} for f in obj.fandoms.all()]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")
        if request:
            if instance.image:
                representation["cover_image"] = request.build_absolute_uri(instance.image.url)
            else:
                representation["cover_image"] = representation.get("cover_image")
            representation["background_image"] = representation.get("cover_image")
        return representation


# Зворотна сумісність для імпортів
BooksNewsSerializer = HomeBookCardSerializer
