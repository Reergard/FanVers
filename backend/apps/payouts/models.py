from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.payouts.fields import EncryptedCharField
from apps.users.balance_access import profile_can_request_balance_withdraw


class PayoutProfile(models.Model):
    """KYC + податковий статус + адреса для виплат (окремо від users.Profile)."""

    class VerificationStatus(models.TextChoices):
        DRAFT = "draft", "Чернетка (не подано на перевірку)"
        PENDING = "pending", "Очікує перевірки"
        APPROVED = "approved", "Підтверджено"
        REJECTED = "rejected", "Відхилено"
        REQUIRES_MORE_INFO = "requires_more_info", "Потрібна додаткова інформація"
        CANCELLED = "cancelled", "Скасовано користувачем"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payout_profile",
    )
    country = models.CharField(
        max_length=2,
        help_text="ISO 3166-1 alpha-2: UA, CZ, DE, IT, US",
    )
    full_name_legal = models.CharField(
        max_length=200,
        help_text="ПІБ як у паспорті",
    )
    full_name_latin = models.CharField(
        max_length=200,
        help_text="ПІБ латиницею",
    )
    address_line = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    verification_status = models.CharField(
        max_length=32,
        choices=VerificationStatus.choices,
        default=VerificationStatus.DRAFT,
        db_index=True,
    )
    verification_notes = models.TextField(blank=True)
    payout_approved = models.BooleanField(
        default=False,
        help_text="Чи дозволено отримувати виплати",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Профіль виплат"
        verbose_name_plural = "Профілі виплат"
        indexes = [
            models.Index(fields=["verification_status", "payout_approved"]),
        ]

    def __str__(self):
        return f"PayoutProfile({self.user.username}, {self.verification_status})"

    @property
    def can_request_payout(self) -> bool:
        if not profile_can_request_balance_withdraw(self.user.profile):
            return False
        if self.verification_status != self.VerificationStatus.APPROVED:
            return False
        if not self.payout_approved:
            return False
        if not self.methods.filter(is_active=True).exists():
            return False
        return True


class PayoutMethod(models.Model):
    """Метод виплати (реквізити). На старті — Wise IBAN."""

    class MethodType(models.TextChoices):
        WISE_IBAN = "wise_iban", "Wise (IBAN)"

    profile = models.ForeignKey(
        PayoutProfile,
        on_delete=models.CASCADE,
        related_name="methods",
    )
    method_type = models.CharField(
        max_length=32,
        choices=MethodType.choices,
        default=MethodType.WISE_IBAN,
    )
    iban = EncryptedCharField(max_length=256)
    bic_swift = EncryptedCharField(max_length=256, blank=True)
    recipient_full_name = models.CharField(max_length=200)
    currency = models.CharField(max_length=3, default="UAH")
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=True)
    iban_changed_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    successful_payouts_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Метод виплати"
        verbose_name_plural = "Методи виплат"
        constraints = [
            models.UniqueConstraint(
                fields=["profile"],
                condition=models.Q(is_default=True, is_active=True),
                name="unique_default_active_method_per_profile",
            ),
        ]



class PayoutBatch(models.Model):
    """Партія виплат для Wise Batch Payments CSV."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Чернетка"
        CSV_GENERATED = "csv_generated", "CSV згенеровано"
        SENT_TO_WISE = "sent_to_wise", "Завантажено у Wise"
        CONFIRMED = "confirmed", "Усі виплати пройшли"
        PARTIAL = "partial", "Частково виплачено"
        FAILED = "failed", "Не вдалось"

    name = models.CharField(max_length=100)
    csv_file = models.FileField(
        upload_to="payouts/batches/%Y/%m/",
        blank=True,
        null=True,
    )
    total_amount_by_currency = models.JSONField(default=dict)
    total_count = models.PositiveIntegerField(default=0)
    completed_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    wise_batch_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    csv_generated_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_batches",
    )

    class Meta:
        verbose_name = "Batch виплат"
        verbose_name_plural = "Batches виплат"
        ordering = ["-created_at"]


class PayoutRequest(models.Model):
    """Запит на виведення коштів з балансу."""

    class Status(models.TextChoices):
        PENDING = "pending", "Подано"
        AWAITING_REVIEW = "awaiting_review", "На перевірці"
        APPROVED = "approved", "Схвалено, готовий до batch"
        IN_BATCH = "in_batch", "Включений у batch"
        PROCESSING = "processing", "Відправлений у Wise"
        COMPLETED = "completed", "Виплачено"
        FAILED = "failed", "Wise відхилив"
        CANCELLED = "cancelled", "Скасовано"

    profile = models.ForeignKey(
        PayoutProfile,
        on_delete=models.PROTECT,
        related_name="payout_requests",
    )
    method = models.ForeignKey(
        PayoutMethod,
        on_delete=models.PROTECT,
        related_name="payout_requests",
    )
    balance_log = models.OneToOneField(
        "users.BalanceLog",
        on_delete=models.PROTECT,
        related_name="payout_request",
        null=True,
        blank=True,
    )
    batch = models.ForeignKey(
        PayoutBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    is_urgent = models.BooleanField(
        default=False,
        help_text="Терміновий вивід (комісія 10%, дедлайн 3 дні)",
        db_index=True,
    )
    coins_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2)
    commission_coins = models.DecimalField(max_digits=12, decimal_places=2)
    coins_after_commission = models.DecimalField(max_digits=12, decimal_places=2)
    payout_currency = models.CharField(max_length=3)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6)
    amount_gross = models.DecimalField(max_digits=12, decimal_places=2)
    withholding_tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    withholding_tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    amount_net = models.DecimalField(max_digits=12, decimal_places=2)
    # Snapshot KYC-даних на момент створення запиту
    snapshot_country = models.CharField(max_length=2, blank=True)
    snapshot_full_name_legal = models.CharField(max_length=200, blank=True)
    snapshot_full_name_latin = models.CharField(max_length=200, blank=True)
    snapshot_address_line = models.CharField(max_length=300, blank=True)
    snapshot_city = models.CharField(max_length=100, blank=True)
    snapshot_postal_code = models.CharField(max_length=20, blank=True)
    # Snapshot реквізитів
    snapshot_recipient_name = models.CharField(max_length=200)
    snapshot_iban = EncryptedCharField(max_length=256)
    snapshot_bic_swift = EncryptedCharField(max_length=256, blank=True)
    snapshot_method_type = models.CharField(max_length=32)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    wise_transfer_id = models.CharField(max_length=64, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=64, blank=True, db_index=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_payouts",
        help_text="Адмін, який схвалив запит",
    )
    auto_check_result = models.JSONField(default=dict, blank=True)
    failure_reason = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    invoice_number = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        unique=True,
    )
    invoice_pdf = models.FileField(
        upload_to="payouts/invoices/%Y/%m/",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    auto_checked_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    deadline_at = models.DateTimeField(
        help_text="Дата до якої зобов'язані відправити (created_at + 14 днів)",
    )

    class Meta:
        verbose_name = "Запит на виплату"
        verbose_name_plural = "Запити на виплати"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "deadline_at"]),
            models.Index(fields=["profile", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(coins_amount__gt=0),
                name="payout_coins_amount_positive",
            ),
            models.CheckConstraint(
                check=models.Q(amount_gross__gt=0),
                name="payout_amount_gross_positive",
            ),
            models.CheckConstraint(
                check=models.Q(amount_net__gt=0),
                name="payout_amount_net_positive",
            ),
        ]

    def __str__(self):
        return (
            f"PayoutRequest #{self.id} {self.amount_net} {self.payout_currency} "
            f"({self.status})"
        )

    def save(self, *args, **kwargs):
        if not self.deadline_at:
            days = (
                settings.PAYOUT_URGENT_DEADLINE_DAYS
                if self.is_urgent
                else settings.PAYOUT_DEADLINE_DAYS
            )
            self.deadline_at = timezone.now() + timedelta(days=days)
        super().save(*args, **kwargs)


class WiseWebhookDelivery(models.Model):
    """Персистентна дедуплікація вебхуків Wise за X-Delivery-Id."""

    delivery_id = models.CharField(max_length=128, unique=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Wise Webhook Delivery"
        verbose_name_plural = "Wise Webhook Deliveries"
        indexes = [
            models.Index(fields=["received_at"]),
        ]
