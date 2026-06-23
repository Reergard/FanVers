import csv
import io


_CSV_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def _safe_csv_value(value):
    """Захист від CSV formula injection (перевіряє і після strip для пробілів перед формулою)."""
    if isinstance(value, str) and value:
        if value[0] in _CSV_DANGEROUS_PREFIXES:
            return "'" + value
        stripped = value.lstrip()
        if stripped and stripped[0] in _CSV_DANGEROUS_PREFIXES:
            return "'" + value
    return value


def generate_wise_csv(payout_requests):
    """
    Генерує CSV для Wise Batch Payments.
    sourceCurrency — з settings.WISE_SOURCE_CURRENCY (рахунок FanVers).
    targetCurrency — валюта отримувача (з PayoutMethod).
    amountCurrency = "target" → amount_net вже сконвертована у валюту отримувача.
    """
    from django.conf import settings as django_settings

    source_currency = django_settings.WISE_SOURCE_CURRENCY
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "name",
        "recipientEmail",
        "receiverType",
        "amount",
        "sourceCurrency",
        "targetCurrency",
        "amountCurrency",
        "IBAN",
        "BIC",
        "reference",
    ])
    for req in payout_requests:
        writer.writerow([
            _safe_csv_value(req.snapshot_recipient_name),
            "",
            "PRIVATE",
            str(req.amount_net),
            source_currency,
            req.payout_currency,
            "target",
            _safe_csv_value(req.snapshot_iban),
            _safe_csv_value(req.snapshot_bic_swift or ""),
            f"FV-{req.id}",
        ])
    return output.getvalue()
