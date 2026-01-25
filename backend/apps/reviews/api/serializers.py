from rest_framework import serializers
from apps.reviews.models import BookComment, ChapterComment
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.shortcuts import get_object_or_404
from apps.catalog.models import Book, Chapter

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'profile_image']
    
    def get_profile_image(self, obj):
        if hasattr(obj, 'profile') and obj.profile.image:
            return obj.profile.image.url
        return None

class BaseCommentSerializer(serializers.ModelSerializer):
    likes_count = serializers.SerializerMethodField()
    dislikes_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    user = UserSerializer(read_only=True)
    has_owner_like = serializers.SerializerMethodField()
    owner_like_type = serializers.SerializerMethodField()

    def validate_text(self, value):
        """Валидация текста комментария"""
        if not value or not value.strip():
            raise serializers.ValidationError("Комментарий не может быть пустым")
        
        text = value.strip()
        if len(text) < 3:
            raise serializers.ValidationError("Комментарий слишком короткий (минимум 3 символа)")
        
        if len(text) > 1000:
            raise serializers.ValidationError("Комментарий слишком длинный (максимум 1000 символов)")
        
        return text

    def get_likes_count(self, obj):
        return obj.get_likes_count()

    def get_dislikes_count(self, obj):
        return obj.get_dislikes_count()

    def get_user_reaction(self, obj):
        user = self.context['request'].user
        if user.is_authenticated:
            if user in obj.likes.all():
                return 'like'
            elif user in obj.dislikes.all():
                return 'dislike'
        return None

    def get_has_owner_like(self, obj):
        return obj.has_owner_like()

    def get_owner_like_type(self, obj):
        if obj.owner_like:
            book = obj.book if hasattr(obj, 'book') else obj.chapter.book
            return 'Автора' if book.book_type == 'AUTHOR' else 'Перекладача'
        return None

class BookCommentSerializer(BaseCommentSerializer):
    replies = serializers.SerializerMethodField()
    book = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = BookComment
        fields = ['id', 'book', 'user', 'text', 'parent', 'created_at', 'likes_count', 'dislikes_count', 'user_reaction', 'replies', 'has_owner_like', 'owner_like_type']
        read_only_fields = ['id', 'created_at', 'likes_count', 'dislikes_count', 'user_reaction', 'replies', 'has_owner_like', 'owner_like_type']

    def get_replies(self, obj):
        if obj.replies.exists():
            return BookCommentSerializer(obj.replies.all(), many=True, context=self.context).data
        return []

    def create(self, validated_data):
        book_slug = self.context['view'].kwargs.get('slug')
        book = get_object_or_404(Book, slug=book_slug)
        validated_data['book'] = book
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class ChapterCommentSerializer(BaseCommentSerializer):
    replies = serializers.SerializerMethodField()
    chapter = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    user = UserSerializer(read_only=True)
    has_owner_like = serializers.SerializerMethodField()
    owner_like_type = serializers.SerializerMethodField()

    class Meta:
        model = ChapterComment
        fields = ['id', 'chapter', 'user', 'text', 'parent', 'created_at', 'likes_count', 'dislikes_count', 'user_reaction', 'has_owner_like', 'owner_like_type', 'replies']
        read_only_fields = ['id', 'created_at', 'likes_count', 'dislikes_count', 'user_reaction', 'has_owner_like', 'owner_like_type', 'replies']

    def get_replies(self, obj):
        if obj.replies.exists():
            return ChapterCommentSerializer(obj.replies.all(), many=True, context=self.context).data
        return []

    def get_has_owner_like(self, obj):
        return obj.has_owner_like()

    def get_owner_like_type(self, obj):
        if obj.owner_like:
            book = obj.chapter.book
            return 'Автора' if book.book_type == 'AUTHOR' else 'Перекладача'
        return None

    def create(self, validated_data):
        chapter_slug = self.context['view'].kwargs.get('slug')
        chapter = get_object_or_404(Chapter, slug=chapter_slug)
        validated_data['chapter'] = chapter
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
