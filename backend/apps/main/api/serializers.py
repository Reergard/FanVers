from rest_framework import serializers
from apps.catalog.models import Book
import logging

logger = logging.getLogger(__name__)

class BooksNewsSerializer(serializers.ModelSerializer):
    background_image = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    last_chapter_update = serializers.DateTimeField(read_only=True)
    chapters_count = serializers.SerializerMethodField()
    latest_chapter_title = serializers.SerializerMethodField()
    genres = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    fandoms = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'description', 'image',
            'slug', 'background_image', 'cover_image',
            'created_at', 'book_type', 'adult_content',
            'last_chapter_update', 'chapters_count', 'latest_chapter_title',
            'genres', 'tags', 'fandoms'
        ]

    def get_background_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                logger.debug(f"Формування URL для background_image: {obj.image.url}")
                return request.build_absolute_uri(obj.image.url)
        logger.warning(f"Відсутнє зображення для книги {obj.id}")
        return None

    def get_cover_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                logger.debug(f"Формування URL для cover_image: {obj.image.url}")
                return request.build_absolute_uri(obj.image.url)
        logger.warning(f"Відсутнє зображення для книги {obj.id}")
        return None

    def get_chapters_count(self, obj):
        """Возвращает общее количество глав в книге"""
        return obj.chapters.count()

    def get_latest_chapter_title(self, obj):
        """Возвращает название последней добавленной главы"""
        latest_chapter = obj.chapters.order_by('-created_at').first()
        return latest_chapter.title if latest_chapter else None

    def get_genres(self, obj):
        """Возвращает жанры книги"""
        genres = [{'id': genre.id, 'name': genre.name} for genre in obj.genres.all()]
        logger.debug(f"Жанры для книги {obj.id} ({obj.title}): {genres}")
        return genres

    def get_tags(self, obj):
        """Возвращает теги книги"""
        tags = [{'id': tag.id, 'name': tag.name} for tag in obj.tags.all()]
        logger.debug(f"Теги для книги {obj.id} ({obj.title}): {tags}")
        return tags

    def get_fandoms(self, obj):
        """Возвращает фандомы книги"""
        fandoms = [{'id': fandom.id, 'name': fandom.name} for fandom in obj.fandoms.all()]
        logger.debug(f"Фандомы для книги {obj.id} ({obj.title}): {fandoms}")
        return fandoms

    def to_representation(self, instance):
        logger.debug(f"Серіалізація книги: id={instance.id}, title={instance.title}")
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        if request:
            if instance.image:
                representation['cover_image'] = request.build_absolute_uri(instance.image.url)
                logger.debug(f"Cover image URL: {representation['cover_image']}")
            else:
                logger.warning(f"У книги id={instance.id} відсутнє зображення")
            
            representation['background_image'] = representation['cover_image']
        else:
            logger.warning("Відсутній об'єкт request в контексті серіалізатора")
        
        return representation
