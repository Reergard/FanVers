import csv
import io


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
            req.snapshot_recipient_name,
            "",
            req.snapshot_iban,
            req.snapshot_bic_swift or "",
            "UAH",
            str(req.amount_net),
            "UAH",
            f"FV-{req.id}",
        ])
    return output.getvalue()
