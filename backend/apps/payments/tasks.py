from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import PaymentSession


@shared_task
def expire_stale_payment_sessions():
    cutoff = timezone.now() - timedelta(minutes=35)
    updated = PaymentSession.objects.filter(
        status=PaymentSession.STATUS_PENDING,
        created_at__lt=cutoff,
    ).update(status=PaymentSession.STATUS_EXPIRED)
    return f"Expired {updated} sessions"

