from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.payouts.models import PayoutMethod, PayoutRequest

MANUAL_COMPLETE_STATUSES = (
    PayoutRequest.Status.IN_BATCH,
    PayoutRequest.Status.PROCESSING,
)


@transaction.atomic
def mark_payout_request_completed(payout_request, *, wise_transfer_id=""):
    """Позначити заявку виплаченою (ручне підтвердження або reconciliation / webhook)."""
    payout_request = (
        PayoutRequest.objects.select_for_update()
        .filter(pk=payout_request.pk)
        .first()
    )
    if not payout_request:
        raise ValueError("Запит не знайдено")

    if payout_request.status in (
        PayoutRequest.Status.COMPLETED,
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        raise ValueError(
            f"Заявка #{payout_request.pk} уже в статусі «{payout_request.get_status_display()}»"
        )

    update_fields = ["status", "completed_at"]
    payout_request.status = PayoutRequest.Status.COMPLETED
    payout_request.completed_at = timezone.now()
    if wise_transfer_id:
        payout_request.wise_transfer_id = wise_transfer_id
        update_fields.append("wise_transfer_id")

    payout_request.save(update_fields=update_fields)

    PayoutMethod.objects.filter(pk=payout_request.method_id).update(
        last_used_at=timezone.now(),
        successful_payouts_count=F("successful_payouts_count") + 1,
    )
    return payout_request


def mark_payout_request_completed_manual(payout_request):
    """Ручне завершення з адмінки — лише після batch або відправки в Wise."""
    if payout_request.status not in MANUAL_COMPLETE_STATUSES:
        allowed = ", ".join(
            s.label for s in PayoutRequest.Status if s in MANUAL_COMPLETE_STATUSES
        )
        raise ValueError(
            f"Дозволено лише для статусів: {allowed}. "
            f"Поточний: «{payout_request.get_status_display()}»"
        )
    return mark_payout_request_completed(payout_request)
