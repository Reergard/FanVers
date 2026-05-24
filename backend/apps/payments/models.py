import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class PaymentSession(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_EXPIRED = "expired"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "pending"),
        (STATUS_PAID, "paid"),
        (STATUS_EXPIRED, "expired"),
        (STATUS_FAILED, "failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_sessions",
    )

    stripe_session_id = models.CharField(max_length=128, unique=True, db_index=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=128, null=True, blank=True)

    amount_coins = models.DecimalField(max_digits=10, decimal_places=2)
    amount_kopecks = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="uah")

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = _('Платіжна сесія')
        verbose_name_plural = _('Платіжні сесії')
        indexes = [
            models.Index(fields=["status", "created_at"], name="idx_pay_sess_status_created"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "stripe_session_id"],
                name="uniq_payment_session_user_stripe_session",
            ),
        ]

    def mark_expired_if_due(self) -> bool:
        if self.status != self.STATUS_PENDING:
            return False
        if timezone.now() < self.expires_at:
            return False
        self.status = self.STATUS_EXPIRED
        self.save(update_fields=["status"])
        return True


class WebhookEvent(models.Model):
    stripe_event_id = models.CharField(max_length=128, primary_key=True)
    event_type = models.CharField(max_length=64, db_index=True)
    processed_at = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField()

    class Meta:
        verbose_name = _('Webhook-подія')
        verbose_name_plural = _('Webhook-події')
        indexes = [
            models.Index(fields=["event_type", "processed_at"], name="idx_webhook_event_type_time"),
        ]

