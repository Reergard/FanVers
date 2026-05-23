import logging

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.payouts.models import PayoutRequest

logger = logging.getLogger(__name__)

CANCELLABLE_STATUSES = frozenset([
    PayoutRequest.Status.PENDING,
    PayoutRequest.Status.AWAITING_REVIEW,
    PayoutRequest.Status.APPROVED,
])

REFUNDABLE_STATUSES = frozenset([
    PayoutRequest.Status.PENDING,
    PayoutRequest.Status.AWAITING_REVIEW,
    PayoutRequest.Status.APPROVED,
    PayoutRequest.Status.IN_BATCH,
    PayoutRequest.Status.PROCESSING,
])


@transaction.atomic
def cancel_payout_request(payout_request, reason):
    """Скасування запиту з поверненням FanCoins на баланс."""
    payout_request = PayoutRequest.objects.select_for_update().get(
        pk=payout_request.pk
    )

    if payout_request.status in (
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        logger.info(
            "cancel_payout_request #%s: already %s, skipping",
            payout_request.id, payout_request.status,
        )
        return

    if payout_request.status not in CANCELLABLE_STATUSES:
        raise ValidationError("Не можна скасувати запит, що вже у Wise")

    profile = payout_request.profile.user.profile
    profile.balance_operation(payout_request.coins_amount, "refund")

    payout_request.status = PayoutRequest.Status.CANCELLED
    payout_request.failure_reason = reason
    payout_request.save(update_fields=["status", "failure_reason"])

    logger.info(
        "cancel_payout_request #%s: cancelled, refunded %s coins. Reason: %s",
        payout_request.id, payout_request.coins_amount, reason,
    )


@transaction.atomic
def handle_failed_payout(payout_request, wise_reason=""):
    """Невдала виплата (webhook або reconciliation) — refund."""
    payout_request = PayoutRequest.objects.select_for_update().get(
        pk=payout_request.pk
    )

    if payout_request.status in (
        PayoutRequest.Status.COMPLETED,
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        logger.info(
            "handle_failed_payout #%s: already %s, skipping",
            payout_request.id, payout_request.status,
        )
        return

    if payout_request.status not in REFUNDABLE_STATUSES:
        logger.warning(
            "handle_failed_payout #%s: unexpected status %s",
            payout_request.id, payout_request.status,
        )
        return

    profile = payout_request.profile.user.profile
    profile.balance_operation(payout_request.coins_amount, "refund")

    payout_request.status = PayoutRequest.Status.FAILED
    payout_request.failure_reason = wise_reason
    payout_request.save(update_fields=["status", "failure_reason"])

    logger.info(
        "handle_failed_payout #%s: failed, refunded %s coins. Reason: %s",
        payout_request.id, payout_request.coins_amount, wise_reason,
    )
