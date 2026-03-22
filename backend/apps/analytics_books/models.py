from django.db import models
from django.utils import timezone
from apps.catalog.models import Book
from datetime import timedelta

class BookAnalytics(models.Model):
    book = models.OneToOneField(Book, on_delete=models.CASCADE, related_name='analytics')
    views_count = models.IntegerField(default=0)
    comments_count = models.IntegerField(default=0)
    book_ratings_count = models.IntegerField(default=0)
    translation_ratings_count = models.IntegerField(default=0)
    comment_likes_count = models.IntegerField(default=0)
    bookmarks_count = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Analytics for {self.book.title}"

class DailyAnalytics(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='daily_analytics')
    date = models.DateField()
    views = models.IntegerField(default=0)
    comments = models.IntegerField(default=0)
    book_ratings = models.IntegerField(default=0)
    translation_ratings = models.IntegerField(default=0)
    comment_likes = models.IntegerField(default=0)
    bookmarks = models.IntegerField(default=0)

    class Meta:
        unique_together = ('book', 'date')
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['book', 'date'])
        ]

    def __str__(self):
        return f"Daily analytics for {self.book.title} on {self.date}"

    @classmethod
    def get_analytics_for_period(cls, book, days):
        """
        Суми сирих полів за останні `days` календарних днів включно з сьогодні.
        Зважені очки як у ТОПу за періодом: `weighted_totals_for_period_dict(result)`
        у `apps.analytics_books.services.scoring`.
        """
        if days < 1:
            days = 1
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        analytics = cls.objects.filter(
            book=book,
            date__gte=start_date,
            date__lte=end_date,
        ).aggregate(
            total_views=models.Sum("views"),
            total_comments=models.Sum("comments"),
            total_book_ratings=models.Sum("book_ratings"),
            total_translation_ratings=models.Sum("translation_ratings"),
            total_comment_likes=models.Sum("comment_likes"),
            total_bookmarks=models.Sum("bookmarks"),
        )

        return {
            "views": analytics["total_views"] or 0,
            "comments": analytics["total_comments"] or 0,
            "book_ratings": analytics["total_book_ratings"] or 0,
            "translation_ratings": analytics["total_translation_ratings"] or 0,
            "comment_likes": analytics["total_comment_likes"] or 0,
            "bookmarks": analytics["total_bookmarks"] or 0,
        }


class CommentLikeAnalyticsEvent(models.Model):
    """
    Подія зміни лайка коментаря (+1 / -1) за календарний день.
    Джерело для нічного перерахунку DailyAnalytics.comment_likes (M2M без timestamp).
    """

    book = models.ForeignKey(
        Book, on_delete=models.CASCADE, related_name="+", db_index=True
    )
    day = models.DateField(db_index=True)
    delta = models.SmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["book", "day"]),
        ]