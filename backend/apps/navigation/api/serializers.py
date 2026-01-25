from rest_framework import serializers
from ..models import Bookmark
from apps.catalog.api.serializers import BookReaderSerializer, ChapterSerializer

class BookmarkSerializer(serializers.ModelSerializer):
    book = BookReaderSerializer(read_only=True)  
    book_id = serializers.IntegerField(write_only=True) 
    
    class Meta:
        model = Bookmark
        fields = ('id', 'book', 'book_id', 'status', 'created_at', 'updated_at')
        depth = 1

    def to_representation(self, instance):
        """Передаємо request в контекст для BookReaderSerializer"""
        representation = super().to_representation(instance)
        # Передаємо request в контекст для правильного відображення bookmark_status
        if 'request' in self.context:
            book_serializer = BookReaderSerializer(instance.book, context=self.context)
            representation['book'] = book_serializer.data
        return representation
