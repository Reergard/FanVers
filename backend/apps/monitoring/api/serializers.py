from rest_framework import serializers
from apps.monitoring.models import UserChapterProgress, AuthorThanks
from decimal import Decimal

class UserChapterProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserChapterProgress
        fields = ['is_read', 'is_purchased', 'scroll_position', 
                 'reading_time', 'last_read_at', 'reading_progress']

class UserReadingStatsSerializer(serializers.Serializer):
    read_chapters = serializers.IntegerField()
    purchased_chapters = serializers.IntegerField()
    completed_books = serializers.IntegerField()

class AuthorThanksSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthorThanks
        fields = ['id', 'giver', 'receiver', 'book', 'amount', 'message', 'created_at']
        read_only_fields = ['id', 'giver', 'receiver', 'book', 'created_at']

class CreateAuthorThanksSerializer(serializers.Serializer):
    book_id = serializers.IntegerField(min_value=1)
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('20'),
        max_value=Decimal('10000'),
    )
    idempotency_key = serializers.CharField(
        min_length=8,
        max_length=64,
        trim_whitespace=True,
        allow_blank=False,
    )
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate_message(self, value):
        """Валидация сообщения"""
        if value and len(value.strip()) > 500:
            raise serializers.ValidationError("Повідомлення не може перевищувати 500 символів")
        return value.strip() if value else "" 