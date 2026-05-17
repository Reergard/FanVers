import base64
import json
import logging

import requests as http_requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.payouts.models import PayoutRequest

logger = logging.getLogger(__name__)


def verify_wise_signature(request):
    """Перевірка RSA-підпису Wise webhook (X-Signature-SHA256WithRSA)."""
    if not getattr(settings, "WISE_WEBHOOK_ENABLED", False):
        return False

    signature_header = request.headers.get("X-Signature-SHA256WithRSA", "")
    if not signature_header:
        return False

    wise_public_key_pem = cache.get("wise_public_key")
    if not wise_public_key_pem:
        try:
            resp = http_requests.get(
                "https://api.wise.com/v3/public-keys",
                timeout=10,
            )
            resp.raise_for_status()
            keys_data = resp.json()
            for key_entry in keys_data:
                if key_entry.get("status") == "ACTIVE":
                    wise_public_key_pem = key_entry["key"]
                    break
            if not wise_public_key_pem:
                logger.error("Wise: немає активного публічного ключа")
                return False
            cache.set("wise_public_key", wise_public_key_pem, 86400)
        except Exception as e:
            logger.error("Wise: помилка отримання публічного ключа: %s", e)
            return False

    try:
        public_key = serialization.load_pem_public_key(
            wise_public_key_pem.encode()
        )
        signature_bytes = base64.b64decode(signature_header)
        public_key.verify(
            signature_bytes,
            request.body,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except Exception as e:
        logger.warning("Wise webhook: невалідний підпис: %s", e)
        return False


def process_wise_webhook(data):
    """Обробка transfers#state-change від Wise."""
    event_type = data.get("eventType", "")
    if event_type != "transfers#state-change":
        return

    resource = data.get("data", {}).get("resource", {})
    transfer_status = resource.get("status", "")
    reference = resource.get("reference", "")

    if not reference.startswith("FV-"):
        return
    try:
        payout_id = int(reference.split("-", 1)[1])
    except (ValueError, IndexError):
        return

    payout_request = PayoutRequest.objects.filter(id=payout_id).first()
    if not payout_request:
        return

    if transfer_status == "outgoing_payment_sent":
        payout_request.status = PayoutRequest.Status.COMPLETED
        payout_request.completed_at = timezone.now()
        payout_request.wise_transfer_id = str(resource.get("id", ""))
        payout_request.save(
            update_fields=["status", "completed_at", "wise_transfer_id"]
        )
        method = payout_request.method
        method.last_used_at = timezone.now()
        method.successful_payouts_count += 1
        method.save(update_fields=["last_used_at", "successful_payouts_count"])
    elif transfer_status in ("funds_refunded", "cancelled"):
        from apps.payouts.services.payout_cancel import handle_failed_payout

        handle_failed_payout(payout_request, f"Wise status: {transfer_status}")
