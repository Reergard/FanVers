from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.catalog.models import Chapter, Book
from apps.users.models import Profile
from django.db.models import Count, Q, F


class TransactionLog(models.Model):
    buyer = models.ForeignKey(
        Profile, 
        on_delete=models.CASCADE,
        related_name='purchases'
    )
    owner = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='sales'
    )
    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Null для покупки пакета підписки (prepaid/bulk)'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE
    )
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    commission_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )
    commission_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    final_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Audit: request_id, plan_id, balance_before, balance_after, subscription_before, subscription_after
    audit_metadata = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

class BalanceOperationLog(models.Model):
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='balance_operations'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    operation_type = models.CharField(
        max_length=20,
        choices=[
            ('deposit', 'Поповнення'),
            ('withdraw', 'Виведення')
        ]
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('completed', 'Завершено'),
            ('failed', 'Помилка')
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Журнал операцій з балансом'
        verbose_name_plural = 'Журнал операцій з балансом'

    def __str__(self):
        return f"{self.operation_type} від {self.profile.user.username}"




class UserChapterProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, 
                           on_delete=models.CASCADE,
                           related_name='chapter_progress')
    chapter = models.ForeignKey('catalog.Chapter', 
                              on_delete=models.CASCADE,
                              related_name='user_progress')
    is_read = models.BooleanField(default=False)
    is_purchased = models.BooleanField(default=False)
    scroll_position = models.FloatField(default=0)
    reading_time = models.IntegerField(default=0)  # в секундах
    last_read_at = models.DateTimeField(auto_now=True)
    reading_speed = models.FloatField(default=0) 

    class Meta:
        unique_together = ('user', 'chapter')
        verbose_name = 'Прогрес читання'
        verbose_name_plural = 'Прогрес читання'
        indexes = [
            models.Index(fields=['user', 'chapter']),
            models.Index(fields=['is_read']),
            models.Index(fields=['is_purchased']),
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', 'is_purchased']),
            models.Index(fields=['chapter', 'is_read']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.chapter.title}"

    @property
    def reading_progress(self):
        return min(100, (self.scroll_position / 90) * 100)

    @classmethod
    def get_user_stats(cls, user):
        """Отримання статистики читання користувача"""
        from django.db.models import Count, Q
        from apps.catalog.models import Book

        stats = {
            'read_chapters': cls.objects.filter(user=user, is_read=True).count(),
            'purchased_chapters': cls.objects.filter(user=user, is_purchased=True).count(),
        }

        # Підрахунок повністю прочитаних книг
        books = Book.objects.annotate(
            total_chapters=Count('chapters'),
            read_chapters=Count(
                'chapters',
                filter=Q(
                    chapters__user_progress__user=user,  
                    chapters__user_progress__is_read=True
                )
            )
        ).filter(total_chapters__gt=0)

        stats['completed_books'] = books.filter(
            total_chapters=models.F('read_chapters')
        ).count()

        return stats

class AdvertisingLog(models.Model):
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='advertising_logs'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='advertising_logs'
    )
    location = models.CharField(
        max_length=20,
        choices=[
            ('main', 'Реклама на Головній'),
            ('catalog', 'Реклама на Каталозі'),
            ('search', 'Реклама в пошуку'),
        ]
    )
    target_kind = models.CharField(
        max_length=10,
        choices=[
            ('none', 'Без таргету'),
            ('genre', 'Жанр'),
            ('tag', 'Тег'),
            ('fandom', 'Фендом'),
        ],
        default='none',
    )
    target_id = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Журнал реклами'
        verbose_name_plural = 'Журнал реклами'

    def __str__(self):
        return f"Реклама книги {self.book.title} від {self.user.username}"


class BookView(models.Model):
    """Модель для отслеживания уникальных просмотров книг"""
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='book_views'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='user_views'
    )
    viewed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Перегляд книги'
        verbose_name_plural = 'Перегляди книг'
        indexes = [
            models.Index(fields=['book', 'viewed_at']),
            models.Index(fields=['user', 'viewed_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} переглянув {self.book.title} {self.viewed_at.date()}"
    
    @classmethod
    def get_daily_views(cls, book, date=None):
        """Получение количества уникальных просмотров книги за день"""
        from django.utils import timezone
        if date is None:
            date = timezone.now().date()
        
        return cls.objects.filter(
            book=book,
            viewed_at__date=date
        ).values('user').distinct().count()


class AuthorThanks(models.Model):
    """Модель для благодарностей авторам/переводчикам"""
    giver = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='given_thanks',
        verbose_name='Хто подякував'
    )
    receiver = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='received_thanks',
        verbose_name='Кому подякували'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='thanks_received',
        verbose_name='Книга'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Сума подяки'
    )
    message = models.TextField(
        blank=True,
        null=True,
        verbose_name='Повідомлення'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата подяки'
    )
    idempotency_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        verbose_name='Ключ ідемпотентності',
        help_text='Унікальний ключ з клієнта; повтор з тим самим ключем не списує баланс повторно.',
    )

    class Meta:
        verbose_name = 'Подяка авторові'
        verbose_name_plural = 'Подяки авторам'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=('giver', 'idempotency_key'),
                condition=Q(idempotency_key__isnull=False) & ~Q(idempotency_key=''),
                name='monitoring_authorthanks_giver_idem_uniq',
            ),
        ]
        indexes = [
            models.Index(fields=['giver', 'created_at']),
            models.Index(fields=['receiver', 'created_at']),
            models.Index(fields=['book', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.giver.username} подякував {self.receiver.username} за {self.book.title} на {self.amount} FanCoins"