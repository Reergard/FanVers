from django.core.exceptions import ValidationError
from django.db import transaction

from apps.payouts.models import PayoutRequest


@transaction.atomic
def cancel_payout_request(payout_request, reason):
    """Скасування запиту з поверненням FanCoins на баланс."""
    if payout_request.status in (
        PayoutRequest.Status.PROCESSING,
        PayoutRequest.Status.COMPLETED,
    ):
        raise ValidationError("Не можна скасувати запит, що вже у Wise")

    payout_request = PayoutRequest.objects.select_for_update().get(
        pk=payout_request.pk
    )

    if payout_request.status in (
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        return

    profile = payout_request.profile.user.profile
    profile.update_balance(payout_request.coins_amount, "refund")

    payout_request.status = PayoutRequest.Status.CANCELLED
    payout_request.failure_reason = reason
    payout_request.save(update_fields=["status", "failure_reason"])


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
        return

    profile = payout_request.profile.user.profile
    profile.update_balance(payout_request.coins_amount, "refund")

    payout_request.status = PayoutRequest.Status.FAILED
    payout_request.failure_reason = wise_reason
    payout_request.save(update_fields=["status", "failure_reason"])
