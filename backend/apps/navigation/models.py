from django.db import models
from django.contrib.auth import get_user_model
from apps.catalog.models import Book, Chapter
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()

class Bookmark(models.Model):
    STATUS_CHOICES = [
        ('reading', 'Читаю'),
        ('dropped', 'Кинув читати'),
        ('planned', 'В планах'),
        ('completed', 'Прочитав'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="bookmarks")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'book')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} - {self.book.title} ({self.status})"

class ChapterPagination:
    NO_PAGINATION_LIMIT = 50
    LARGE_BOOK_THRESHOLD = 1000
    PAGE_SIZE_DEFAULT = 50
    PAGE_SIZE_LARGE = 100

    @staticmethod
    def get_chapters_per_page(total_chapters):
        """Определяет количество глав на странице в зависимости от общего количества"""
        if total_chapters <= ChapterPagination.NO_PAGINATION_LIMIT:
            return total_chapters
        if total_chapters >= ChapterPagination.LARGE_BOOK_THRESHOLD:
            return ChapterPagination.PAGE_SIZE_LARGE
        return ChapterPagination.PAGE_SIZE_DEFAULT

    @staticmethod
    def get_page_ranges(total_chapters):
        """Возвращает список диапазонов страниц для выпадающего списка"""
        if total_chapters <= ChapterPagination.NO_PAGINATION_LIMIT:
            return []

        chapters_per_page = ChapterPagination.get_chapters_per_page(total_chapters)
        ranges = []
        start = 1

        while start <= total_chapters:
            end = min(start + chapters_per_page - 1, total_chapters)
            ranges.append({
                'start': start,
                'end': end,
                'label': f'{start}-{end}'
            })
            start += chapters_per_page

        return ranges
