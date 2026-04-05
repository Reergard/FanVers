from rest_framework import serializers
from ..models import Notification
from apps.catalog.api.serializers import BookReaderSerializer

class NotificationSerializer(serializers.ModelSerializer):
    book = BookReaderSerializer(allow_null=True, required=False)
    error_report_id = serializers.IntegerField(source='error_report.id', read_only=True, allow_null=True)
    reporter_username = serializers.SerializerMethodField()
    # SerializerMethodField: надійніше ніж source='book.title' разом із вкладеним BookReaderSerializer
    book_title = serializers.SerializerMethodField()
    chapter_title = serializers.SerializerMethodField()
    error_text = serializers.SerializerMethodField()
    suggestion = serializers.SerializerMethodField()

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
            'book_title',
            'chapter_title',
            'error_text',
            'suggestion',
        ]

    def get_reporter_username(self, obj):
        if obj.error_report and obj.error_report.user:
            return obj.error_report.user.username
        return None

    def get_book_title(self, obj):
        if obj.book_id and obj.book:
            return obj.book.title
        return None

    def get_chapter_title(self, obj):
        if obj.error_report and obj.error_report.chapter:
            return obj.error_report.chapter.title
        return None

    def get_error_text(self, obj):
        if obj.error_report:
            return obj.error_report.error_text
        return None

    def get_suggestion(self, obj):
        if obj.error_report:
            return obj.error_report.suggestion or None
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.book:
            data['book'] = None
            data['book_title'] = None
        if not instance.error_report:
            data['error_report_id'] = None
            data['reporter_username'] = None
            data['chapter_title'] = None
            data['error_text'] = None
            data['suggestion'] = None
        return data