import os
import uuid
from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from .middleware import get_current_request
from .managers import CustomUserManager

from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum
from django.core.cache import cache
from django.db.models import Count, Q, F
from django.contrib.staticfiles.storage import staticfiles_storage
from datetime import datetime
import logging
from decimal import Decimal

from .balance_access import (
    API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE,
    profile_can_request_balance_withdraw,
)

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
    total_characters = models.BigIntegerField(
        default=0,
        verbose_name='Загальна кількість символів',
        help_text='Накопичена сума символів по всіх главах книг власника. '
                  'Оновлюється автоматично при збереженні/видаленні глав.',
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
    # Cookie consent (зберігаємо лише користувацький вибір; necessary завжди true на фронті/бекенді)
    # Приклад:
    # {
    #   "necessary": true,
    #   "preferences": false,
    #   "analytics": false,
    #   "updated_at": "2026-04-02T12:34:56Z"
    # }
    cookie_consent = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Cookie consent'
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
        default=True,
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
        constraints = [
            models.CheckConstraint(
                check=models.Q(balance__gte=0),
                name="balance_non_negative",
            ),
        ]

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

    MIN_DEPOSIT_AMOUNT = 100
    MIN_WITHDRAW_AMOUNT = 1000
    MAX_BALANCE = Decimal('1000000')
    MAX_DEPOSIT_AMOUNT = Decimal('100000')
    MAX_WITHDRAW_AMOUNT = Decimal('50000')

    DEBIT_OPERATIONS = frozenset([
        'withdraw', 'purchase', 'advertising', 'thanks_given',
    ])
    CREDIT_OPERATIONS = frozenset([
        'deposit', 'earning', 'thanks_received', 'refund',
    ])

    def balance_operation(self, amount, operation_type, description=''):
        """
        Єдиний метод зміни балансу з блокуванням рядка (select_for_update).
        Повертає BalanceLog запис.
        """
        if not isinstance(amount, (int, float, Decimal)) or amount <= 0:
            raise ValidationError('Сума операції повинна бути більше нуля')

        if isinstance(amount, float):
            amount = Decimal(str(amount))

        if operation_type == 'deposit':
            if amount < self.MIN_DEPOSIT_AMOUNT:
                raise ValidationError(
                    f'Мінімальна сума поповнення: {self.MIN_DEPOSIT_AMOUNT} FanCoins'
                )
            if Decimal(str(amount)) > self.MAX_DEPOSIT_AMOUNT:
                raise ValidationError(
                    f'Максимальна сума поповнення: {self.MAX_DEPOSIT_AMOUNT} FanCoins'
                )
        elif operation_type == 'withdraw':
            if amount < self.MIN_WITHDRAW_AMOUNT:
                raise ValidationError(
                    f'Мінімальна сума виведення: {self.MIN_WITHDRAW_AMOUNT} FanCoins'
                )
            if Decimal(str(amount)) > self.MAX_WITHDRAW_AMOUNT:
                raise ValidationError(
                    f'Максимальна сума виведення: {self.MAX_WITHDRAW_AMOUNT} FanCoins'
                )

        if operation_type not in self.DEBIT_OPERATIONS and operation_type not in self.CREDIT_OPERATIONS:
            raise ValidationError(f'Невідомий тип операції: {operation_type}')

        with transaction.atomic():
            profile = Profile.objects.select_for_update().get(pk=self.pk)

            if operation_type == 'withdraw':
                if not profile_can_request_balance_withdraw(profile):
                    raise ValidationError(API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE)

            if operation_type in self.DEBIT_OPERATIONS:
                if profile.balance < amount:
                    raise ValidationError(
                        f'Недостатньо коштів. Доступно: {profile.balance} FanCoins, '
                        f'потрібно: {amount} FanCoins'
                    )
                profile.balance -= amount
            else:
                new_balance = profile.balance + amount
                if new_balance > self.MAX_BALANCE:
                    raise ValidationError('Максимальний баланс: 1,000,000 FanCoins')
                profile.balance = new_balance

            profile.save(update_fields=['balance'])

            balance_log = profile.balance_logs.create(
                amount=amount,
                operation_type=operation_type,
                description=description,
                status='completed',
            )

            if operation_type in ('deposit', 'withdraw', 'refund'):
                try:
                    from apps.monitoring.models import BalanceOperationLog
                    BalanceOperationLog.objects.create(
                        profile=profile,
                        amount=amount,
                        operation_type=operation_type,
                        status='completed',
                    )
                except Exception:
                    logger.error(
                        "Failed to create BalanceOperationLog for profile=%s op=%s",
                        profile.pk, operation_type, exc_info=True,
                    )

            return balance_log

    
    def can_perform_operation(self, operation_type, amount=None):
        """Перевірка для UI-підказок. НЕ використовувати для фінансових рішень —
        використовуйте balance_operation() з select_for_update."""
        if operation_type == 'withdraw' and amount is not None:
            return self.balance >= amount
        return True

    def can_withdraw_balance(self):
        """Чи дозволено користувачу ініціювати виведення через API (лише за роллю)."""
        return profile_can_request_balance_withdraw(self)

    @property
    def has_active_payout_profile(self) -> bool:
        """Чи має користувач схвалений профіль виплат."""
        try:
            return self.user.payout_profile.can_request_payout
        except Exception:
            return False

    @property
    def payout_profile_status(self) -> str | None:
        """Статус верифікації профілю виплат (None якщо профілю немає)."""
        try:
            return self.user.payout_profile.verification_status
        except Exception:
            return None

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
        """Оновлення комісії на основі накопиченого total_characters.

        Пороги: ≥10 млн → 10%, ≥5 млн → 12%, інакше → 15%.
        Запис у БД виконується лише якщо значення змінилося.
        """
        total_chars = self.total_characters  # хранимое поле — без агрегатного запроса

        if total_chars >= 10_000_000:
            new_commission = Decimal('10.00')
        elif total_chars >= 5_000_000:
            new_commission = Decimal('12.00')
        else:
            new_commission = Decimal('15.00')

        if self.commission != new_commission:
            self.commission = new_commission
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
            ('advertising', 'Реклама'),
            ('refund', 'Повернення'),
            ('thanks_given', 'Подяка (списання)'),
            ('thanks_received', 'Подяка (зарахування)'),
        ]
    )
    description = models.CharField(
        max_length=300,
        blank=True,
        default='',
        verbose_name='Опис операції',
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


class BalanceIdempotencyRecord(models.Model):
    """
    Prevents double-apply of deposit/withdraw operations on network retries.
    """

    OP_DEPOSIT = "deposit"
    OP_WITHDRAW = "withdraw"
    OP_CHOICES = [
        (OP_DEPOSIT, "deposit"),
        (OP_WITHDRAW, "withdraw"),
    ]

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="balance_idempotency_records")
    key = models.CharField(max_length=64)
    operation_type = models.CharField(max_length=16, choices=OP_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "key"], name="uniq_balance_idempotency_user_key"),
        ]


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


@receiver(pre_save, sender='catalog.Chapter')
def capture_old_chapter_chars(sender, instance, **kwargs):
    """Запам'ятовує поточний characters_count з БД перед збереженням.

    Необхідно для точного розрахунку дельти в post_save:
    delta = new_characters_count - old_characters_count.
    Для нових об'єктів (pk=None) old = 0.
    """
    if instance.pk:
        try:
            old = sender.objects.only('characters_count').get(pk=instance.pk)
            instance._old_characters_count = old.characters_count or 0
        except sender.DoesNotExist:
            instance._old_characters_count = 0
    else:
        instance._old_characters_count = 0


@receiver(post_save, sender='catalog.Chapter')
def update_profile_on_chapter_save(sender, instance, **kwargs):
    """Атомарно оновлює Profile.total_characters власника і перераховує комісію.

    Використовує дельту (new - old), щоб уникнути повного агрегатного запиту.
    F()-вираз гарантує атомарність при конкурентних запитах.
    Комісія перераховується лише якщо символи реально змінилися.
    """
    if not instance.book_id:
        return

    new_count = instance.characters_count or 0
    old_count = getattr(instance, '_old_characters_count', 0) or 0
    delta = new_count - old_count

    if delta == 0:
        return

    try:
        owner_id = instance.book.owner_id
    except Exception:
        return

    if not owner_id:
        return

    # Атомарний UPDATE: без SELECT + збереження об'єкту, безпечно при конкуренції
    updated = Profile.objects.filter(user_id=owner_id).update(
        total_characters=F('total_characters') + delta
    )
    if not updated:
        return

    # Отримуємо свіжий профіль для перерахунку комісії
    try:
        profile = Profile.objects.get(user_id=owner_id)
    except Profile.DoesNotExist:
        return

    profile.update_commission()


@receiver(post_delete, sender='catalog.Chapter')
def update_profile_on_chapter_delete(sender, instance, **kwargs):
    """Вираховує символи видаленої глави з Profile.total_characters власника.

    Викликається після фізичного видалення глави з БД.
    """
    chars = instance.characters_count or 0
    if chars == 0 or not instance.book_id:
        return

    try:
        owner_id = instance.book.owner_id
    except Exception:
        return

    if not owner_id:
        return

    updated = Profile.objects.filter(user_id=owner_id).update(
        total_characters=F('total_characters') - chars
    )
    if not updated:
        return

    try:
        profile = Profile.objects.get(user_id=owner_id)
    except Profile.DoesNotExist:
        return

    profile.update_commission()


@receiver(post_save, sender='monitoring.UserChapterProgress')
def clear_reading_stats_cache(sender, instance, **kwargs):
    """Очищення кешу статистики при оновленні прогресу читання"""
    if instance.user and hasattr(instance.user, 'profile'):
        instance.user.profile.clear_reading_stats_cache()
