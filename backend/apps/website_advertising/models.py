from django.db import models
from django.core.exceptions import ValidationError
from apps.users.models import User
from apps.catalog.models import Book
import logging

logger = logging.getLogger(__name__)

class Advertisement(models.Model):
    LOCATION_CHOICES = [
        ('main', 'Головна сторінка'),
        ('catalog', 'Каталог'),
        ('genres', 'Пошук за жанрами'),
        ('tags', 'Пошук за тегами'),
        ('fandoms', 'Пошук за фендомами'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='advertisements')
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='advertisements')
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Реклама'
        verbose_name_plural = 'Реклами'
        indexes = [
            models.Index(fields=['book', 'location', 'start_date', 'end_date']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['location', 'start_date', 'end_date']),
        ]

    def __str__(self):
        return f'Реклама для {self.book.title} від {self.user.username}'

    def clean(self):
        if not self.pk:  # Тільки для нових записів
            overlapping = Advertisement.objects.filter(
                book=self.book,
                location=self.location,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
                is_active=True
            )
            
            if overlapping.exists():
                logger.warning(f"Знайдено пересічні реклами для книги {self.book.title}")
                raise ValidationError(
                    f'Для книги "{self.book.title}" вже є активна реклама на вибрані дати'
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
