from rest_framework import serializers
from ..models import Notification
from apps.catalog.api.serializers import BookReaderSerializer

class NotificationSerializer(serializers.ModelSerializer):
    book = BookReaderSerializer(allow_null=True, required=False)
    error_report_id = serializers.IntegerField(source='error_report.id', read_only=True, allow_null=True)
    reporter_username = serializers.CharField(source='error_report.user.username', read_only=True, allow_null=True)
    book_title = serializers.CharField(source='book.title', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id', 
            'message', 
            'created_at', 
            'is_read', 
            'book',
            'error_report_id',
            'reporter_username',
            'book_title'
        ]

    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)
            # Обрабатываем случай, когда book может быть None
            if not instance.book:
                data['book'] = None
                data['book_title'] = None
            # Обрабатываем случай, когда error_report может быть None
            if not instance.error_report:
                data['error_report_id'] = None
                data['reporter_username'] = None
            return data
        except Exception as e:
            # Fallback для случаев ошибок сериализации
            return {
                'id': instance.id,
                'message': instance.message,
                'created_at': instance.created_at,
                'is_read': instance.is_read,
                'book': None,
                'error_report_id': None,
                'reporter_username': None,
                'book_title': None
            }