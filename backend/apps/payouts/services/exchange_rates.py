import logging
from decimal import Decimal, InvalidOperation

import requests as http_requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

WISE_RATES_URL = "https://api.wise.com/v1/rates"
CACHE_KEY_PREFIX = "wise_rate"
CACHE_TTL = 600  # 10 хвилин


class RateFetchError(Exception):
    """Помилка отримання курсу від Wise API."""


def _get_headers():
    token = getattr(settings, "WISE_API_TOKEN", "")
    if not token:
        raise RateFetchError(
            "WISE_API_TOKEN не налаштовано. "
            "Додайте токен у .env або введіть курс вручну."
        )
    return {"Authorization": f"Bearer {token}"}


def fetch_rate(source: str, target: str) -> Decimal:
    """
    Отримує актуальний курс source → target від Wise API.
    Повертає Decimal (наприклад 0.022300 для UAH → EUR).
    Кешується на 10 хвилин.
    """
    source = source.upper()
    target = target.upper()

    if source == target:
        return Decimal("1.000000")

    cache_key = f"{CACHE_KEY_PREFIX}:{source}:{target}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = http_requests.get(
            WISE_RATES_URL,
            params={"source": source, "target": target},
            headers=_get_headers(),
            timeout=10,
        )
    except http_requests.RequestException as exc:
        raise RateFetchError(f"Помилка з'єднання з Wise API: {exc}")

    if resp.status_code == 401:
        raise RateFetchError(
            "Wise API: невірний токен (401). Перевірте WISE_API_TOKEN."
        )
    if resp.status_code == 403:
        raise RateFetchError(
            "Wise API: доступ заборонено (403). Перевірте права токена."
        )
    if resp.status_code != 200:
        raise RateFetchError(
            f"Wise API повернув статус {resp.status_code}: {resp.text[:200]}"
        )

    try:
        data = resp.json()
    except ValueError:
        raise RateFetchError("Wise API: невалідна JSON-відповідь.")

    if not data or not isinstance(data, list):
        raise RateFetchError(
            f"Wise API: пуста або невірна відповідь для {source} → {target}."
        )

    try:
        rate = Decimal(str(data[0]["rate"])).quantize(Decimal("0.000001"))
    except (KeyError, IndexError, InvalidOperation) as exc:
        raise RateFetchError(f"Wise API: не вдалось розпарсити курс: {exc}")

    if rate <= 0:
        raise RateFetchError(f"Wise API: некоректний курс {rate} для {source} → {target}.")

    cache.set(cache_key, rate, CACHE_TTL)

    logger.info("Wise rate fetched: %s → %s = %s", source, target, rate)
    return rate


def apply_rate_to_payout(payout_request) -> Decimal:
    """
    Отримує курс UAH → payout_currency та оновлює exchange_rate і amount_net.
    Повертає нову amount_net.
    """
    if payout_request.payout_currency == "UAH":
        return payout_request.amount_net

    rate = fetch_rate("UAH", payout_request.payout_currency)
    tax = payout_request.withholding_tax_amount or Decimal("0.00")
    amount_net = (payout_request.amount_gross * rate - tax).quantize(Decimal("0.01"))

    payout_request.exchange_rate = rate
    payout_request.amount_net = amount_net
    payout_request.save(update_fields=["exchange_rate", "amount_net"])

    return amount_net
