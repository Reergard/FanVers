import csv
import io

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.payouts.models import PayoutMethod, PayoutRequest
from apps.payouts.services.payout_cancel import handle_failed_payout


def import_wise_reconciliation_csv(csv_content, batch_id=None):
    """Імпорт reconciliation CSV з Wise для оновлення статусів."""
    reader = csv.DictReader(io.StringIO(csv_content))
    results = {"updated": 0, "failed": 0, "skipped": 0}

    for row in reader:
        reference = row.get("Reference", "") or row.get("reference", "")
        if not reference.startswith("FV-"):
            results["skipped"] += 1
            continue
        try:
            payout_id = int(reference.split("-", 1)[1])
        except (ValueError, IndexError):
            results["skipped"] += 1
            continue

        wise_status = (row.get("Status", "") or row.get("status", "")).upper()
        transfer_id = row.get("Transfer ID", "") or row.get("transfer_id", "")

        if wise_status == "COMPLETED":
            _reconcile_completed(payout_id, transfer_id, results, batch_id)
        elif wise_status in ("REFUNDED", "CANCELLED", "FAILED"):
            _reconcile_failed(payout_id, wise_status, results, batch_id)
        else:
            results["skipped"] += 1

    return results


@transaction.atomic
def _reconcile_completed(payout_id, transfer_id, results, batch_id=None):
    payout_request = (
        PayoutRequest.objects.select_for_update()
        .filter(id=payout_id)
        .first()
    )
    if not payout_request:
        results["skipped"] += 1
        return

    if batch_id and payout_request.batch_id != batch_id:
        results["skipped"] += 1
        return

    if payout_request.status in (
        PayoutRequest.Status.COMPLETED,
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        results["skipped"] += 1
        return

    payout_request.status = PayoutRequest.Status.COMPLETED
    payout_request.completed_at = timezone.now()
    payout_request.wise_transfer_id = transfer_id
    payout_request.save(
        update_fields=["status", "completed_at", "wise_transfer_id"]
    )
    PayoutMethod.objects.filter(pk=payout_request.method_id).update(
        last_used_at=timezone.now(),
        successful_payouts_count=F("successful_payouts_count") + 1,
    )
    results["updated"] += 1


@transaction.atomic
def _reconcile_failed(payout_id, wise_status, results, batch_id=None):
    payout_request = (
        PayoutRequest.objects.select_for_update()
        .filter(id=payout_id)
        .first()
    )
    if not payout_request:
        results["skipped"] += 1
        return

    if batch_id and payout_request.batch_id != batch_id:
        results["skipped"] += 1
        return

    if payout_request.status in (
        PayoutRequest.Status.COMPLETED,
        PayoutRequest.Status.CANCELLED,
        PayoutRequest.Status.FAILED,
    ):
        results["skipped"] += 1
        return

    handle_failed_payout(
        payout_request,
        f"Wise reconciliation: {wise_status}",
    )
    results["failed"] += 1
