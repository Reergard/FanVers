import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payouts", "0004_add_kyc_snapshots"),
    ]

    operations = [
        # #9: Persistent webhook deduplication
        migrations.CreateModel(
            name="WiseWebhookDelivery",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "delivery_id",
                    models.CharField(max_length=128, unique=True),
                ),
                (
                    "received_at",
                    models.DateTimeField(auto_now_add=True),
                ),
            ],
            options={
                "verbose_name": "Wise Webhook Delivery",
                "verbose_name_plural": "Wise Webhook Deliveries",
            },
        ),
        migrations.AddIndex(
            model_name="wisewebhookdelivery",
            index=models.Index(
                fields=["received_at"],
                name="payouts_wis_receive_idx",
            ),
        ),
        # #30: PayoutBatch.status max_length 16 -> 32
        migrations.AlterField(
            model_name="payoutbatch",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Чернетка"),
                    ("csv_generated", "CSV згенеровано"),
                    ("sent_to_wise", "Завантажено у Wise"),
                    ("confirmed", "Усі виплати пройшли"),
                    ("partial", "Частково виплачено"),
                    ("failed", "Не вдалось"),
                ],
                default="draft",
                max_length=32,
            ),
        ),
        # #12: CheckConstraints on PayoutRequest positive amounts
        migrations.AddConstraint(
            model_name="payoutrequest",
            constraint=models.CheckConstraint(
                check=models.Q(("coins_amount__gt", 0)),
                name="payout_coins_amount_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="payoutrequest",
            constraint=models.CheckConstraint(
                check=models.Q(("amount_gross__gt", 0)),
                name="payout_amount_gross_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="payoutrequest",
            constraint=models.CheckConstraint(
                check=models.Q(("amount_net__gt", 0)),
                name="payout_amount_net_positive",
            ),
        ),
    ]
