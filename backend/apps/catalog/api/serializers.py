from rest_framework import serializers
from apps.catalog.models import Book, Chapter, Genres, Tag, Country, Fandom, Volume, ChapterOrder
from apps.navigation.models import Bookmark 
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class GenresSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genres
        fields = '__all__'
        depth = 1


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'
        depth = 1


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'
        depth = 1


class FandomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fandom
        fields = '__all__'
        depth = 1


class ChapterSerializer(serializers.ModelSerializer):
    is_purchased = serializers.SerializerMethodField()
    volume_title = serializers.SerializerMethodField()
    book_title = serializers.CharField(source='book.title', read_only=True)
    slug = serializers.CharField(read_only=True)
    order = serializers.IntegerField(read_only=True)
    volume = serializers.PrimaryKeyRelatedField(
        queryset=Volume.objects.all(),
        required=False,
        allow_null=True
    )
    book_slug = serializers.SerializerMethodField()
    price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        coerce_to_string=False
    )

    class Meta:
        model = Chapter
        fields = [
            'id', 'title', 'book', 'book_title', 'slug', 'file', 
            'is_paid', 'is_purchased', 'volume', 
            'volume_title', 'order', 'book_slug', 'price', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'is_purchased', 'created_at']

    def get_book_slug(self, obj):
        return obj.book.slug if obj.book else None

    def get_is_purchased(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        from apps.catalog.api.permissions import is_book_owner_or_creator
        if is_book_owner_or_creator(request.user, obj.book):
            return True
        purchased_ids = self.context.get('purchased_chapter_ids')
        if purchased_ids is not None:
            return obj.id in purchased_ids
        from apps.subscription.services import user_has_chapter_access
        return user_has_chapter_access(request.user, obj.id)

    def get_volume_title(self, obj):
        return obj.volume.title if obj.volume else None

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['order'] = instance.order
        representation['price'] = float(instance.price) if instance.price else 1.00
        representation['slug'] = instance.slug

        # Перевіряємо існування файлу
        if instance.file:
            try:
                if not instance.file.storage.exists(instance.file.name):
                    representation['file'] = None
            except Exception as e:
                logger.error(f"Помилка перевірки існування файлу: {str(e)}")
                representation['file'] = None

        # Контент глави не включаємо в список — він видається тільки через chapter_detail()
        # з перевіркою download_permission та покупки платної глави.
        return representation

    def validate(self, data):
        request = self.context.get('request')
        book = self.context.get('book')
        
        if not request or not request.user:
            raise serializers.ValidationError('Необхідна авторизація')
            
        if book and book.owner != request.user:
            raise serializers.ValidationError('У вас немає прав для додавання глав до цієї книги')
            
        return data


class BookOwnerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    owner_username = serializers.SerializerMethodField()
    creator_username = serializers.SerializerMethodField()
    translation_status_display = serializers.CharField(source='get_translation_status_display', read_only=True)
    original_status_display = serializers.CharField(source='get_original_status_display', read_only=True)
    translation_status = serializers.CharField(
        required=False,
        allow_null=True
    )
    genres = GenresSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    fandoms = FandomSerializer(many=True, read_only=True)
    country = CountrySerializer(read_only=True)

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'title_en', 'author', 'description', 'image',
            'translation_status', 'translation_status_display',
            'original_status', 'original_status_display',
            'country', 'slug', 'last_updated', 'owner', 'creator',
            'adult_content', 'owner_username', 'creator_username', 'book_type',
            'genres', 'tags', 'fandoms', 'view_permission', 'comment_book_permission',
            'comment_chapter_permission', 'download_permission', 'rate_permission'
        ]
        read_only_fields = ['slug', 'last_updated', 'owner', 'creator']

    def validate(self, data):
        book_type = data.get('book_type')
        
        if book_type == 'AUTHOR':
            data['translation_status'] = None
        elif book_type == 'TRANSLATION':
            current_status = data.get('translation_status')
            data['translation_status'] = current_status or 'TRANSLATING'
        
        return data

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_creator_username(self, obj):
        return obj.creator.username if obj.creator else None

    def update(self, instance, validated_data):
        old_ts = instance.translation_status
        instance = super().update(instance, validated_data)
        if instance.book_type == 'TRANSLATION' and instance.owner_id and old_ts != instance.translation_status:
            Book.mark_translation_owner_activity(instance)
        return instance

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['owner'] = request.user
            validated_data['creator'] = request.user
        book = super().create(validated_data)
        if book.book_type == 'TRANSLATION' and book.owner_id:
            Book.mark_translation_owner_activity(book)
        return book


class BookReaderSerializer(serializers.ModelSerializer):
    bookmark_status = serializers.SerializerMethodField()
    bookmark_id = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    owner_username = serializers.SerializerMethodField()
    creator_username = serializers.SerializerMethodField()
    translation_status_display = serializers.CharField(source='get_translation_status_display', read_only=True)
    original_status_display = serializers.CharField(source='get_original_status_display', read_only=True)
    translation_status = serializers.CharField(read_only=True)
    original_status = serializers.CharField(read_only=True)
    chapters_count = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    genres = GenresSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    fandoms = FandomSerializer(many=True, read_only=True)
    country = CountrySerializer(read_only=True)

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'title_en', 'author', 'description', 'image',
            'translation_status', 'translation_status_display', 
            'original_status', 'original_status_display',
            'country', 'slug', 'last_updated', 'owner_username', 
            'creator_username', 'bookmark_status', 'bookmark_id', 
            'adult_content', 'book_type', 'chapters_count',
            'genres', 'tags', 'fandoms', 'created_at'
        ]
        read_only_fields = fields

    def get_chapters_count(self, obj):
        return obj.chapters.count()

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_bookmark_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            bookmark = Bookmark.objects.filter(
                book=obj,
                user=request.user
            ).first()
            return bookmark.status if bookmark else None
        return None

    def get_bookmark_id(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            bookmark = Bookmark.objects.filter(
                book=obj,
                user=request.user
            ).first()
            return bookmark.id if bookmark else None
        return None

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_creator_username(self, obj):
        return obj.creator.username if obj.creator else None


class VolumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volume
        fields = ['id', 'title', 'book', 'order']


class ChapterOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterOrder
        fields = ['id', 'volume', 'chapter', 'position']


class BookCreateSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False)
    translation_status = serializers.CharField(required=False, allow_null=True)
    genres = serializers.PrimaryKeyRelatedField(
        queryset=Genres.objects.all(),
        many=True,
        required=False
    )
    tags = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        many=True,
        required=False
    )
    fandoms = serializers.PrimaryKeyRelatedField(
        queryset=Fandom.objects.all(),
        many=True,
        required=False
    )
    country = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(),
        required=True
    )

    class Meta:
        model = Book
        fields = [
            'title', 'title_en', 'author', 'description', 'image',
            'translation_status', 'original_status', 'country',
            'genres', 'tags', 'fandoms', 'adult_content', 'book_type',
            'view_permission', 'comment_book_permission', 'comment_chapter_permission',
            'download_permission', 'rate_permission'
        ]

    def validate(self, data):
        book_type = data.get('book_type')
        
        if book_type == 'AUTHOR':
            data['translation_status'] = None
        elif book_type == 'TRANSLATION':
            current_status = data.get('translation_status')
            data['translation_status'] = current_status or 'TRANSLATING'
            
        # Детальная валидация обязательных полей
        errors = {}
        
        if not data.get('title'):
            errors['title'] = "Назва книги обов'язкова"
            
        if not data.get('author'):
            errors['author'] = "Ім'я автора обов'язкове"
            
        if not data.get('country'):
            errors['country'] = "Країна обов'язкова"
            
        if not data.get('genres'):
            errors['genres'] = "Виберіть хоча б один жанр"
            
        if book_type == 'TRANSLATION' and not data.get('translation_status'):
            errors['translation_status'] = "Оберіть статус перекладу"
        elif book_type == 'TRANSLATION' and data.get('translation_status') and self.instance is None:
            # Забороняємо створення книг із забороненими статусами (лише при створенні, не при оновленні)
            invalid_statuses = ['Перерва', 'Закінчено', 'Зупинено', 'ABANDONED', 'COMPLETED', 'STOPPED']
            current_status = data.get('translation_status')
            if current_status in invalid_statuses:
                errors['translation_status'] = f"Не можна створити книгу зі статусом '{current_status}'. Для нових книг використовуйте статус 'Перекладається' або 'TRANSLATING'"
        
        if not data.get('original_status'):
            errors['original_status'] = "Оберіть статус випуску оригіналу"
        
        # Дополнительные проверки
        if data.get('title') and len(data.get('title', '').strip()) < 2:
            errors['title'] = "Назва книги повинна містити мінімум 2 символи"
            
        if data.get('description') and len(data.get('description', '').strip()) < 10:
            errors['description'] = "Опис повинен містити мінімум 10 символів"
            
        if data.get('genres') and len(data.get('genres', [])) > 5:
            errors['genres'] = "Можна вибрати максимум 5 жанрів"
            
        if data.get('tags') and len(data.get('tags', [])) > 10:
            errors['tags'] = "Можна вибрати максимум 10 тегів"
        
        if errors:
            print(f"BookCreateSerializer.validate: Найдены ошибки валидации: {errors}")
            raise serializers.ValidationError(errors)
            
        return data

    def create(self, validated_data):
        genres = validated_data.pop('genres', [])
        tags = validated_data.pop('tags', [])
        fandoms = validated_data.pop('fandoms', [])

        book = Book.objects.create(**validated_data)

        if genres:
            book.genres.set(genres)
        if tags:
            book.tags.set(tags)
        if fandoms:
            book.fandoms.set(fandoms)

        if book.book_type == 'TRANSLATION' and book.owner_id:
            Book.mark_translation_owner_activity(book)

        return book

    def update(self, instance, validated_data):
        old_ts = instance.translation_status
        genres = validated_data.pop('genres', None)
        tags = validated_data.pop('tags', None)
        fandoms = validated_data.pop('fandoms', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if genres is not None:
            instance.genres.set(genres)
        if tags is not None:
            instance.tags.set(tags)
        if fandoms is not None:
            instance.fandoms.set(fandoms)

        if instance.book_type == 'TRANSLATION' and instance.owner_id and old_ts != instance.translation_status:
            Book.mark_translation_owner_activity(instance)

        return instance

