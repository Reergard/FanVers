from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth import get_user_model
from apps.catalog.models import Book

User = get_user_model()


class BookRating(models.Model):
    RATING_TYPES = (
        ('BOOK', 'Рейтінг книги'),
        ('TRANSLATION', 'Рейтінг перекладу'),
    )

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='ratings')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating_type = models.CharField(max_length=20, choices=RATING_TYPES)
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('book', 'user', 'rating_type')
        verbose_name = 'Рейтинг книги'
        verbose_name_plural = 'Рейтинги книг'

    def clean(self):
        super().clean()
        if self.rating_type != "TRANSLATION" or not self.book_id:
            return
        # Один запит: узгоджено з доменом (AUTHOR не має оцінки перекладу)
        bt = Book.objects.filter(pk=self.book_id).values_list("book_type", flat=True).first()
        if bt == "AUTHOR":
            raise ValidationError(
                {
                    "rating_type": "Оцінка якості перекладу недоступна для авторських книг."
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.book.title} - {self.get_rating_type_display()} - {self.rating}"