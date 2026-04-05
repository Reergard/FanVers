from rest_framework import serializers
from apps.editors.models import ChapterEdit
from apps.catalog.models import Chapter, Volume
from apps.catalog.api.serializers import ChapterSerializer
from ..models import ErrorReport
from apps.catalog.models import Book

class ChapterEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterEdit
        fields = ['id', 'chapter', 'title', 'file', 'volume', 'is_paid', 'edited_at']


class ErrorReportSerializer(serializers.ModelSerializer):
    # Клієнт шле book_id / chapter_id; обов'язковість перевіряємо в validate()
    book = serializers.PrimaryKeyRelatedField(
        queryset=Book.objects.all(), required=False, allow_null=True
    )
    chapter = serializers.PrimaryKeyRelatedField(
        queryset=Chapter.objects.all(), required=False, allow_null=True
    )
    book_id = serializers.IntegerField(write_only=True, required=False)
    chapter_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = ErrorReport
        fields = ['id', 'book', 'chapter', 'book_id', 'chapter_id', 
                 'error_text', 'suggestion', 'book_title', 
                 'chapter_title', 'user_username', 'created_at']
        read_only_fields = ['user', 'created_at', 'book_title', 
                           'chapter_title', 'user_username']

    def validate(self, data):
        try:
            if 'book_id' in data:
                data['book'] = Book.objects.get(id=data['book_id'])
            if 'chapter_id' in data:
                data['chapter'] = Chapter.objects.get(id=data['chapter_id'])

            book = data.get('book')
            chapter = data.get('chapter')
            if book is None or chapter is None:
                raise serializers.ValidationError(
                    "Потрібні ідентифікатори книги та розділу (book_id, chapter_id)."
                )

            if chapter.book_id != book.id:
                raise serializers.ValidationError(
                    "Глава не належить вказаній книзі."
                )

            data.pop('book_id', None)
            data.pop('chapter_id', None)
            return data
        except (Book.DoesNotExist, Chapter.DoesNotExist):
            raise serializers.ValidationError(
                "Вказана книга або розділ не існує."
            )