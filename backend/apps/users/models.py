import os
import uuid
from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from .middleware import get_current_request
from .managers import CustomUserManager

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum
from django.core.cache import cache
from django.db.models import Count, Q, F
from django.contrib.staticfiles.storage import staticfiles_storage
from datetime import datetime
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def generate_token():
    return str(uuid.uuid4())


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(_("Логін"), max_length=20, unique=True)
    email = models.EmailField(_("Email"), max_length=254, unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    token = models.CharField(max_length=255, default=generate_token)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    objects = CustomUserManager()

    class Meta:
        verbose_name = _("Користувач")
        verbose_name_plural = _("Користувачі")

    def __str__(self):
        return self.email


class Profile(models.Model):
    # def get_upload_to(self, instance, filename):
    #     """Generate a dynamic path for profile images."""
    #     ext = filename.split('.')[-1]  # Get file extension
    #     filename = f"profile_{instance.user.id}.{ext}"  # Rename file
    #     return os.path.join('users/profile_images/', filename)  # Return new path

    def get_upload_to(self, instance):
        """Генерує безпечний шлях для збереження аватара"""
        basename = str(uuid.uuid4())
        discard, ext = os.path.splitext(instance)
        # Структура: avatars/{user_id}/{year}/{month}/{uuid}.webp
        user_id = self.user.id if hasattr(self, 'user') else 'unknown'
        year = datetime.now().year
        month = datetime.now().month
        return f'avatars/{user_id}/{year}/{month:02d}/{basename}.webp'

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    username = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=50, unique=True)
    about = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to=get_upload_to, null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    token = models.CharField(max_length=255, default=generate_token)
    is_default = models.BooleanField(default=False)
    balance = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        verbose_name='Баланс'
    )
    purchased_chapters = models.ManyToManyField('catalog.Chapter', blank=True, related_name='purchased_by')
    role = models.CharField(
        max_length=20,
        choices=[
            ('Читач', 'Читач'), 
            ('Перекладач', 'Перекладач'),
            ('Літератор', 'Літератор')
        ],
        default='Читач',
        verbose_name='Роль користувача',
        help_text='Оберіть роль користувача. Роль визначає права доступу та можливості користувача.',
        blank=False,
        null=False
    )
    commission = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('15.00'),
        verbose_name='Комісія (%)'
    )
    
    # Настройки сповіщений
    notifications_enabled = models.BooleanField(
        default=True,
        verbose_name='Сповіщення увімкнені'
    )
    hide_adult_content = models.BooleanField(
        default=False,
        verbose_name='Прибрати 18+ контент'
    )
    private_messages_enabled = models.BooleanField(
        default=True,
        verbose_name='Приватні повідомлення'
    )
    age_confirmed = models.BooleanField(
        default=False,
        verbose_name='Підтверджено вік 18+'
    )
    
    # Детальні налаштування сповіщений
    comment_notifications = models.BooleanField(
        default=True,
        verbose_name='Сповіщення про коментарі'
    )
    translation_status_notifications = models.BooleanField(
        default=True,
        verbose_name='Сповіщення про статус перекладу'
    )
    chapter_subscription_notifications = models.BooleanField(
        default=True,
        verbose_name='Сповіщення про передплату розділів'
    )
    chapter_comment_notifications = models.BooleanField(
        default=True,
        verbose_name='Сповіщення про коментарі до розділів'
    )

    class Meta:
        verbose_name = 'Профіль'
        verbose_name_plural = 'Профілі'

    def __str__(self):
        if self.image:
            return f"Id:{self.id}, {self.user.username}, Image:{self.image.url}"
        else:
            return f"Id:{self.id}, {self.user.username}"

    def get_profile_image(self, size='default'):
        """Отримання зображення профілю з fallback на ghost зображення"""
        if self.has_custom_image():
            return self.image.url
        
        # Fallback на ghost зображення залежно від розміру
        if size == 'small':
            return staticfiles_storage.url('images/icons/ghost.png')
        elif size == 'large':
            return staticfiles_storage.url('images/icons/ghost_full.png')
        else:
            return staticfiles_storage.url('images/icons/ghost.png')
    
    def has_custom_image(self):
        """Перевірка чи є кастомне зображення"""
        return bool(self.image and getattr(self.image, "name", None))

    def update_balance(self, amount, operation_type):
        with transaction.atomic():
            if operation_type == 'withdraw' and self.balance < amount:
                raise ValidationError('Недостатньо коштів')
            
            if operation_type in ['withdraw', 'purchase', 'advertising']:
                self.balance -= amount
            else:
                self.balance += amount
            
            self.save()
            
            balance_log = self.balance_logs.create(
                amount=amount,
                operation_type=operation_type,
                status='completed'
            )
            
            return balance_log
    
    def can_perform_operation(self, operation_type, amount=None):
        if operation_type == 'withdraw':
            return self.balance >= amount
        return True
    
    @property
    def is_owner(self):
        request = get_current_request()
        if request and request.user:
            return self.user == request.user
        return False
    
    @property
    def total_balance_operations(self):
        return self.balance_logs.all()
    
    def get_balance_history(self, operation_type=None):
        """Отримання історії операцій з балансом"""
        logs = self.balance_logs.all()
        if operation_type:
            logs = logs.filter(operation_type=operation_type)
        return logs

    def clean(self, *args, **kwargs):
        """Валідація профілю перед збереженням"""
        from django.core.exceptions import ValidationError
        
        # Перевіряємо, що роль є допустимою
        valid_roles = ['Читач', 'Перекладач', 'Літератор']
        if self.role and self.role not in valid_roles:
            raise ValidationError({
                'role': f'Невірна роль: {self.role}. Дозволені ролі: {", ".join(valid_roles)}'
            })
        
        super().clean(*args, **kwargs)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def update_commission(self):
        """Оновлення комісії на основі кількості символів"""
        total_chars = self.user.owned_books.aggregate(
            total=models.Sum('chapters__characters_count')
        )['total'] or 0

        if total_chars >= 10000000:  # 10 мільйонів
            self.commission = 10.00
        elif total_chars >= 5000000:  # 5 мільйонів
            self.commission = 12.00
        else:
            self.commission = 15.00
        self.save(update_fields=['commission'])

    def calculate_commission_amount(self, price):
        """Розрахунок суми комісії"""
        return price * (self.commission / 100)

    def get_reading_stats(self):
        """Отримання статистики читання з використанням кешу"""
        cache_key = f'user_reading_stats_{self.user.id}'
        stats = cache.get(cache_key)
        
        if stats is None:
            from apps.monitoring.models import UserChapterProgress
            from apps.catalog.models import Book
            
            # Підрахунок прочитаних та придбаних глав
            read_chapters = UserChapterProgress.objects.filter(
                user=self.user, 
                is_read=True
            ).count()
            
            purchased_chapters = UserChapterProgress.objects.filter(
                user=self.user, 
                is_purchased=True
            ).count()
            
            # Підрахунок повністю прочитаних книг
            books = Book.objects.annotate(
                total_chapters=Count('chapters'),
                read_chapters=Count(
                    'chapters',
                    filter=Q(
                        chapters__reader_progress__user=self.user,
                        chapters__reader_progress__is_read=True
                    )
                )
            ).filter(total_chapters__gt=0)
            
            completed_books = books.filter(
                total_chapters=F('read_chapters')
            ).count()
            
            stats = {
                'read_chapters': read_chapters,
                'purchased_chapters': purchased_chapters,
                'completed_books': completed_books
            }
            
            # Кешуємо на 1 годину
            cache.set(cache_key, stats, 3600)
            
        return stats

    def clear_reading_stats_cache(self):
        """Очищення кешу статистики при оновленні прогресу читання"""
        cache_key = f'user_reading_stats_{self.user.id}'
        cache.delete(cache_key)


class BalanceLog(models.Model):
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='balance_logs'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    operation_type = models.CharField(
        max_length=20,
        choices=[
            ('deposit', 'Поповнення'),
            ('withdraw', 'Виведення'),
            ('purchase', 'Покупка'),
            ('earning', 'Заробіток'),
            ('advertising', 'Реклама')
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'В обробці'),
            ('completed', 'Завершено'),
            ('failed', 'Помилка')
        ],
        default='pending'
    )
    
    class Meta:
        ordering = ['-created_at']


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(
            user=instance,
            username=instance.username,
            email=instance.email
        )


# УБИРАЕМ ЛИШНИЙ СИГНАЛ - он делает profile.save() на каждый user.save()
# @receiver(post_save, sender=User)
# def save_user_profile(sender, instance, **kwargs):
#     instance.profile.save()


@receiver(post_save, sender=User)
def sync_user_email_to_profile(sender, instance, **kwargs):
    """Синхронизация email из User в Profile (односторонняя)"""
    try:
        if hasattr(instance, 'profile') and instance.profile:
            # Проверяем, изменился ли email
            if instance.profile.email != instance.email:
                instance.profile.email = instance.email
                instance.profile.save(update_fields=['email'])
    except Exception as e:
        # Логируем ошибку без эмодзи для продакшена
        pass


# УБИРАЕМ ПРОБЛЕМНЫЙ СИГНАЛ - он перезаписывает User.email из Profile.email!
# @receiver(post_save, sender=Profile)
# def sync_profile_email_to_user(sender, instance, **kwargs):
#     """Синхронизация email между Profile и User"""
#     try:
#         if instance.user and instance.user.email != instance.email:
#             instance.user.email = instance.email
#             instance.user.save(update_fields=['email'])
#             print(f"🔵 Синхронизация email: Profile.email={instance.email} -> User.email={instance.user.email}")
#     except Exception as e:
#         print(f"🔴 Ошибка синхронизации email: {e}")


@receiver(post_save, sender='catalog.Chapter')
def update_user_commission(sender, instance, **kwargs):
    if instance.book and instance.book.owner:
        profile = instance.book.owner.profile
        profile.update_commission()


@receiver(post_save, sender='monitoring.UserChapterProgress')
def clear_reading_stats_cache(sender, instance, **kwargs):
    """Очищення кешу статистики при оновленні прогресу читання"""
    if instance.user and hasattr(instance.user, 'profile'):
        instance.user.profile.clear_reading_stats_cache()
