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
    При першому тестовому батчі звірте колонки з шаблоном Wise Business.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "recipientName",
        "recipientEmail",
        "IBAN",
        "BIC",
        "targetCurrency",
        "targetAmount",
        "sourceCurrency",
        "reference",
    ])
    for req in payout_requests:
        writer.writerow([
            _safe_csv_value(req.snapshot_recipient_name),
            "",
            _safe_csv_value(req.snapshot_iban),
            _safe_csv_value(req.snapshot_bic_swift or ""),
            req.payout_currency,
            str(req.amount_net),
            req.payout_currency,
            f"FV-{req.id}",
        ])
    return output.getvalue()
