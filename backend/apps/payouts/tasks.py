import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def auto_check_payout_request(payout_request_id):
    """Автоперевірка PayoutRequest після створення."""
    from apps.payouts.models import PayoutRequest

    try:
        req = PayoutRequest.objects.select_related("profile", "method").get(
            id=payout_request_id
        )
    except PayoutRequest.DoesNotExist:
        return

    if req.status != PayoutRequest.Status.PENDING:
        return

    checks = {
        "profile_approved": req.profile.payout_approved,
        "min_amount_ok": req.coins_amount >= settings.PAYOUTS_MIN_AMOUNT_COINS,
        "cooldown_ok": not req.method.is_iban_cooldown_active,
        "auto_approve_amount": (
            req.coins_amount <= settings.PAYOUTS_AUTO_APPROVE_THRESHOLD_COINS
        ),
        "has_previous_payouts": req.profile.payout_requests.filter(
            status=PayoutRequest.Status.COMPLETED
        ).exists(),
    }
    req.auto_check_result = checks
    req.auto_checked_at = timezone.now()

    critical_ok = (
        checks["profile_approved"]
        and checks["min_amount_ok"]
        and checks["cooldown_ok"]
    )
    if not critical_ok:
        from apps.payouts.services.payout_cancel import cancel_payout_request

        failed_checks = [
            k
            for k, v in checks.items()
            if not v and k in ("profile_approved", "min_amount_ok", "cooldown_ok")
        ]
        req.save(update_fields=["auto_check_result", "auto_checked_at"])
        cancel_payout_request(
            req, f"Авто-перевірка не пройдена: {', '.join(failed_checks)}"
        )
        return

    all_passed = all(checks.values())
    if all_passed:
        req.status = PayoutRequest.Status.APPROVED
        req.approved_at = timezone.now()
    elif not checks.get("auto_approve_amount") and all(
        v for k, v in checks.items() if k != "auto_approve_amount"
    ):
        req.status = PayoutRequest.Status.AWAITING_REVIEW
    elif not checks.get("has_previous_payouts") and all(
        v for k, v in checks.items() if k != "has_previous_payouts"
    ):
        req.status = PayoutRequest.Status.AWAITING_REVIEW
    else:
        req.status = PayoutRequest.Status.AWAITING_REVIEW

    req.save(
        update_fields=["auto_check_result", "auto_checked_at", "status", "approved_at"]
    )


@shared_task
def check_payout_deadlines():
    """Щоденна перевірка дедлайнів виплат (14 днів)."""
    from apps.payouts.models import PayoutRequest

    now = timezone.now()
    warning_threshold = now + timedelta(days=3)

    active_statuses = [
        PayoutRequest.Status.PENDING,
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
