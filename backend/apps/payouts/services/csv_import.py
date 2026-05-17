import csv
import io

from django.utils import timezone

from apps.payouts.models import PayoutRequest
from apps.payouts.services.payout_cancel import handle_failed_payout


def import_wise_reconciliation_csv(csv_content):
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

        payout_request = PayoutRequest.objects.filter(id=payout_id).first()
        if not payout_request:
            results["skipped"] += 1
            continue

        wise_status = (row.get("Status", "") or row.get("status", "")).upper()
        transfer_id = row.get("Transfer ID", "") or row.get("transfer_id", "")

        if wise_status == "COMPLETED" and payout_request.status != PayoutRequest.Status.COMPLETED:
            payout_request.status = PayoutRequest.Status.COMPLETED
            payout_request.completed_at = timezone.now()
            payout_request.wise_transfer_id = transfer_id
            payout_request.save(
                update_fields=["status", "completed_at", "wise_transfer_id"]
            )
            method = payout_request.method
            method.last_used_at = timezone.now()
            method.successful_payouts_count += 1
            method.save(update_fields=["last_used_at", "successful_payouts_count"])
            results["updated"] += 1
        elif wise_status in ("REFUNDED", "CANCELLED", "FAILED"):
            if payout_request.status not in (
                PayoutRequest.Status.COMPLETED,
                PayoutRequest.Status.CANCELLED,
                PayoutRequest.Status.FAILED,
            ):
                handle_failed_payout(
                    payout_request,
                    f"Wise reconciliation: {wise_status}",
                )
                results["failed"] += 1
            else:
                results["skipped"] += 1
        else:
            results["skipped"] += 1

    return results
