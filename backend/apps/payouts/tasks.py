import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_payout_deadlines():
    """Щоденна перевірка дедлайнів виплат (14 днів)."""
    from apps.payouts.models import PayoutRequest

    now = timezone.now()
    warning_threshold = now + timedelta(days=3)

    active_statuses = [
        PayoutRequest.Status.AWAITING_REVIEW,
        PayoutRequest.Status.APPROVED,
    ]

    approaching = PayoutRequest.objects.filter(
        status__in=active_statuses,
        deadline_at__lte=warning_threshold,
        deadline_at__gt=now,
    )
    approaching_count = approaching.count()
    if approaching_count:
        logger.warning(
            "%d payouts approaching deadline (< 3 days)",
            approaching_count,
        )

    overdue = PayoutRequest.objects.filter(
        status__in=[
            *active_statuses,
            PayoutRequest.Status.IN_BATCH,
            PayoutRequest.Status.PROCESSING,
        ],
        deadline_at__lt=now,
    ).exclude(status=PayoutRequest.Status.COMPLETED)
    overdue_count = overdue.count()

    if overdue_count:
        logger.critical("%d payouts OVERDUE!", overdue_count)

    if approaching_count or overdue_count:
        _send_deadline_email(approaching_count, overdue_count)


def _send_deadline_email(approaching: int, overdue: int):
    admin_email = getattr(settings, "PAYOUT_ADMIN_EMAIL", None)
    if not admin_email:
        return

    parts = []
    if overdue:
        parts.append(f"ПРОСТРОЧЕНО: {overdue} виплат")
    if approaching:
        parts.append(f"Наближається дедлайн: {approaching} виплат (< 3 дні)")

    subject = "[FanVers Payouts] " + "; ".join(parts)
    body = (
        "Автоматичне сповіщення системи виплат FanVers.\n\n"
        + "\n".join(parts)
        + "\n\nПерегляньте адмінку: /admin/payouts/payoutrequest/"
    )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        logger.exception("Failed to send payout deadline email")
