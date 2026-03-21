"""
Subscription models.

Система підписки: налаштування книги, плани (абонементи), покупки користувачів,
історія використання, ідемпотентність операцій.
"""
from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator
from django.db.models import Q
from decimal import Decimal


class BookSubscriptionSettings(models.Model):
    """Налаштування підписки для книги. Логіка — на рівні планів."""
    book = models.OneToOneField(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='subscription_settings'
    )
    is_enabled = models.BooleanField(default=False, verbose_name='Підписка увімкнена')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Налаштування підписки книги'
        verbose_name_plural = 'Налаштування підписок книг'

    def __str__(self):
        return f"Subscription settings: {self.book.title}"


class BookSubscriptionPlan(models.Model):
    """План підписки (абонемент): знижка % від N розділів, режим prepaid або instant."""
    PURCHASE_MODE_PREPAID = 'prepaid'
    PURCHASE_MODE_INSTANT = 'instant'
    PURCHASE_MODE_CHOICES = [
        (PURCHASE_MODE_PREPAID, 'Пакет (prepaid)'),
        (PURCHASE_MODE_INSTANT, 'Миттєва покупка обраних'),
    ]

    settings = models.ForeignKey(
        BookSubscriptionSettings,
        on_delete=models.CASCADE,
        related_name='plans'
    )
    chapters_count = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name='Кількість розділів',
        help_text='Зберігається для backward compat, використовується discount_threshold'
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        default=Decimal('0'),
        verbose_name='Ціна (FanCoins, legacy)',
        help_text='Для backward compat; нова логіка рахує з цін глав'
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        default=Decimal('0'),
        verbose_name='Знижка %'
    )
    discount_threshold = models.PositiveIntegerField(
        default=10,
        verbose_name='Поріг (від N розділів)'
    )
    purchase_mode = models.CharField(
        max_length=20,
        choices=PURCHASE_MODE_CHOICES,
        default=PURCHASE_MODE_PREPAID,
        db_index=True,
        verbose_name='Режим покупки'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активовано')
    sort_order = models.PositiveIntegerField(default=0, verbose_name='Порядок')

    class Meta:
        verbose_name = 'План підписки'
        verbose_name_plural = 'Плани підписки'
        ordering = ['sort_order', 'discount_threshold', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['settings', 'discount_percent', 'discount_threshold', 'purchase_mode'],
                condition=Q(is_active=True),
                name='uniq_active_plan_params'
            ),
        ]

    def __str__(self):
        return f"Знижка {self.discount_percent}% від {self.discount_threshold} розд. ({self.get_purchase_mode_display()})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.settings_id and self.is_active:
            active_count = BookSubscriptionPlan.objects.filter(
                settings=self.settings,
                is_active=True
            ).exclude(pk=self.pk).count()
            if active_count >= 2:
                raise ValidationError(
                    {'is_active': 'Максимум 2 активних плани на книгу'}
                )


class UserBookSubscription(models.Model):
    """Покупка пакета користувачем (prepaid або instant_selected)."""
    PURCHASE_MODE_PREPAID = 'prepaid'
    PURCHASE_MODE_INSTANT_SELECTED = 'instant_selected'
    PURCHASE_MODE_CHOICES = [
        (PURCHASE_MODE_PREPAID, 'Prepaid'),
        (PURCHASE_MODE_INSTANT_SELECTED, 'Instant selected'),
    ]

    STATUS_ACTIVE = 'active'
    STATUS_EXHAUSTED = 'exhausted'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Активний'),
        (STATUS_EXHAUSTED, 'Вичерпано'),
        (STATUS_EXPIRED, 'Закінчився'),
        (STATUS_CANCELLED, 'Скасовано'),
        (STATUS_REFUNDED, 'Повернено кошти'),
    ]

    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='book_subscriptions'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='user_subscriptions'
    )
    plan = models.ForeignKey(
        BookSubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='user_subscriptions'
    )
    # Snapshot на момент покупки (не змінюється при зміні плану)
    purchased_chapters_count = models.PositiveIntegerField(
        verbose_name='Кількість розділів у пакеті (snapshot)'
    )
    remaining_chapters_count = models.PositiveIntegerField(
        default=0,
        verbose_name='Залишок розділів'
    )
    price_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Оплачено (FanCoins, snapshot)'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True
    )
    purchase_mode = models.CharField(
        max_length=20,
        choices=PURCHASE_MODE_CHOICES,
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Підписка користувача на книгу'
        verbose_name_plural = 'Підписки користувачів на книги'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'book'],
                condition=Q(
                    status='active',
                    purchase_mode='prepaid',
                    remaining_chapters_count__gt=0,
                ),
                name='uniq_active_prepaid_per_user_book',
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.book.title}: {self.remaining_chapters_count}/{self.purchased_chapters_count}"


class UserBookSubscriptionUsage(models.Model):
    """Запис використання підписки (consume, bulk_apply, adjustment)."""
    USAGE_TYPE_CONSUME = 'consume'
    USAGE_TYPE_BULK_APPLY = 'bulk_apply'
    USAGE_TYPE_ADJUSTMENT_REFUND = 'adjustment_refund'
    USAGE_TYPE_ADJUSTMENT_RESTORE = 'adjustment_restore'
    USAGE_TYPE_CHOICES = [
        (USAGE_TYPE_CONSUME, 'Consume'),
        (USAGE_TYPE_BULK_APPLY, 'Bulk apply'),
        (USAGE_TYPE_ADJUSTMENT_REFUND, 'Adjustment refund'),
        (USAGE_TYPE_ADJUSTMENT_RESTORE, 'Adjustment restore'),
    ]

    SOURCE_CHAPTER_BUY_BUTTON = 'chapter_buy_button'
    SOURCE_BULK_APPLY_REQUEST = 'bulk_apply_request'
    SOURCE_ADMIN_PANEL = 'admin_panel'
    SOURCE_SUPPORT_FIX = 'support_fix'
    SOURCE_CHOICES = [
        (SOURCE_CHAPTER_BUY_BUTTON, 'Chapter buy button'),
        (SOURCE_BULK_APPLY_REQUEST, 'Bulk apply request'),
        (SOURCE_ADMIN_PANEL, 'Admin panel'),
        (SOURCE_SUPPORT_FIX, 'Support fix'),
    ]

    subscription = models.ForeignKey(
        UserBookSubscription,
        on_delete=models.CASCADE,
        related_name='usages'
    )
    chapter = models.ForeignKey(
        'catalog.Chapter',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subscription_usages'
    )
    usage_type = models.CharField(max_length=30, choices=USAGE_TYPE_CHOICES)
    source = models.CharField(max_length=30, choices=SOURCE_CHOICES)
    chapters_consumed = models.PositiveIntegerField(default=1)
    remaining_after = models.PositiveIntegerField(null=True, blank=True)
    # Для consume: встановлюється при restore_slot, щоб заблокувати повторне відновлення
    restored_at = models.DateTimeField(null=True, blank=True, verbose_name='Відновлено (restore)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Використання підписки'
        verbose_name_plural = 'Використання підписок'


class SubscriptionOperation(models.Model):
    """Ідемпотентність операцій: (user, operation_type, idempotency_key) unique."""
    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='subscription_operations'
    )
    operation_type = models.CharField(max_length=50, db_index=True)
    idempotency_key = models.CharField(max_length=255, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    payload_snapshot = models.JSONField(null=True, blank=True)
    result_snapshot = models.JSONField(null=True, blank=True)
    error_code = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Операція підписки'
        verbose_name_plural = 'Операції підписок'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'operation_type', 'idempotency_key'],
                name='uniq_subscription_idempotency'
            ),
        ]


class UserChapterAccess(models.Model):
    """Явна доменна модель доступу користувача до глави."""
    SOURCE_BALANCE = 'balance_purchase'
    SOURCE_PREPAID = 'prepaid_subscription'
    SOURCE_BULK = 'instant_bulk_apply'
    SOURCE_ADMIN = 'admin_restore'

    SOURCE_CHOICES = [
        (SOURCE_BALANCE, 'Balance purchase'),
        (SOURCE_PREPAID, 'Prepaid subscription'),
        (SOURCE_BULK, 'Instant bulk apply'),
        (SOURCE_ADMIN, 'Admin restore'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chapter_accesses'
    )
    chapter = models.ForeignKey(
        'catalog.Chapter',
        on_delete=models.CASCADE,
        related_name='user_accesses'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='chapter_accesses'
    )
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES)
    subscription = models.ForeignKey(
        'subscription.UserBookSubscription',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chapter_accesses',
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Доступ до глави'
        verbose_name_plural = 'Доступи до глав'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'chapter'],
                name='uniq_user_chapter_access',
            ),
        ]


class SubscriptionAdminAuditLog(models.Model):
    """Audit trail для адмінських операцій над підписками."""
    subscription = models.ForeignKey(
        UserBookSubscription,
        on_delete=models.CASCADE,
        related_name='admin_audit_logs'
    )
    operation = models.CharField(max_length=50, db_index=True)
    admin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription_admin_audits'
    )
    request_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    payload = models.JSONField(null=True, blank=True)
    result = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Адмінський аудит підписки'
        verbose_name_plural = 'Адмінські аудити підписок'

    @classmethod
    def log(cls, operation, subscription, admin_user, request_id=None, payload=None, result=None):
        return cls.objects.create(
            subscription=subscription,
            operation=operation,
            admin_user=admin_user,
            request_id=request_id,
            payload=payload,
            result=result,
        )
