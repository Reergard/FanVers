import base64
import json
import logging

import requests as http_requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from django.db import transaction
from django.db.models import F

from apps.payouts.models import PayoutMethod, PayoutRequest

logger = logging.getLogger(__name__)

WISE_KEY_CACHE_KEY = "payouts:wise_public_key_v3"
WISE_KEY_REFRESH_COOLDOWN_KEY = "payouts:wise_key_refresh_cooldown"


def _fetch_wise_public_key():
    """Завантажує активний публічний ключ Wise і кешує на 24 години."""
    try:
        resp = http_requests.get(
            "https://api.wise.com/v3/public-keys",
            timeout=10,
        )
        resp.raise_for_status()
        keys_data = resp.json()
        for key_entry in keys_data:
            if key_entry.get("status") == "ACTIVE":
                pem = key_entry["key"]
                cache.set(WISE_KEY_CACHE_KEY, pem, 86400)
                return pem
        logger.error("Wise: немає активного публічного ключа")
        return None
    except Exception as e:
        logger.error("Wise: помилка отримання публічного ключа: %s", e)
        return None


def _can_refresh_key():
    """Rate-limit на оновлення ключа: максимум раз на 60 секунд."""
    if cache.get(WISE_KEY_REFRESH_COOLDOWN_KEY):
        return False
    cache.set(WISE_KEY_REFRESH_COOLDOWN_KEY, True, 60)
    return True


def _verify_signature(pem, signature_header, body):
    """Перевіряє RSA-підпис. Повертає True/False."""
    public_key = serialization.load_pem_public_key(pem.encode())
    signature_bytes = base64.b64decode(signature_header)
    public_key.verify(
        signature_bytes,
        body,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return True


def verify_wise_signature(request):
    """Перевірка RSA-підпису Wise webhook (X-Signature-SHA256WithRSA).

    При невалідному підписі з кешованим ключем — скидає кеш,
    завантажує ключ заново і пробує ще раз (на випадок ротації ключа).
    """
    if not getattr(settings, "WISE_WEBHOOK_ENABLED", False):
        return False

    signature_header = request.headers.get("X-Signature-SHA256WithRSA", "")
    if not signature_header:
        return False

    wise_public_key_pem = cache.get(WISE_KEY_CACHE_KEY)
    used_cache = bool(wise_public_key_pem)

    if not wise_public_key_pem:
        wise_public_key_pem = _fetch_wise_public_key()
        if not wise_public_key_pem:
            return False

    try:
        _verify_signature(wise_public_key_pem, signature_header, request.body)
        return True
    except Exception as e:
        if used_cache and _can_refresh_key():
            logger.info("Wise webhook: підпис не пройшов з кешованим ключем, оновлюємо")
            cache.delete(WISE_KEY_CACHE_KEY)
            fresh_pem = _fetch_wise_public_key()
            if fresh_pem and fresh_pem != wise_public_key_pem:
                try:
                    _verify_signature(fresh_pem, signature_header, request.body)
                    return True
                except Exception as e2:
                    logger.warning("Wise webhook: невалідний підпис після оновлення ключа: %s", e2)
                    return False
        logger.warning("Wise webhook: невалідний підпис: %s", e)
        return False


@transaction.atomic
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

    payout_request = (
        PayoutRequest.objects.select_for_update()
        .filter(id=payout_id)
        .first()
    )
    if not payout_request:
        return

    if transfer_status == "outgoing_payment_sent":
        if payout_request.status in (
            PayoutRequest.Status.COMPLETED,
            PayoutRequest.Status.CANCELLED,
            PayoutRequest.Status.FAILED,
        ):
            logger.warning(
                "Wise webhook: outgoing_payment_sent для запиту #%s у статусі %s — ігноруємо",
                payout_request.id,
                payout_request.status,
            )
            return

        target_value = resource.get("targetValue")
        if target_value:
            from decimal import Decimal, InvalidOperation
            try:
                webhook_amount = Decimal(str(target_value))
                webhook_currency = resource.get("targetCurrency", "")
                if (
                    webhook_amount != payout_request.amount_net
                    or webhook_currency != payout_request.payout_currency
                ):
                    logger.error(
                        "Wise webhook: amount/currency mismatch for #%s: "
                        "webhook=%s %s, expected=%s %s",
                        payout_request.id,
                        webhook_amount, webhook_currency,
                        payout_request.amount_net, payout_request.payout_currency,
                    )
                    return
            except (InvalidOperation, TypeError):
                logger.warning(
                    "Wise webhook: cannot parse targetValue for #%s",
                    payout_request.id,
                )

        payout_request.status = PayoutRequest.Status.COMPLETED
        payout_request.completed_at = timezone.now()
        payout_request.wise_transfer_id = str(resource.get("id", ""))
        payout_request.save(
            update_fields=["status", "completed_at", "wise_transfer_id"]
        )
        PayoutMethod.objects.filter(pk=payout_request.method_id).update(
            last_used_at=timezone.now(),
            successful_payouts_count=F("successful_payouts_count") + 1,
        )
    elif transfer_status in ("funds_refunded", "cancelled"):
        from apps.payouts.services.payout_cancel import handle_failed_payout

        handle_failed_payout(payout_request, f"Wise status: {transfer_status}")
