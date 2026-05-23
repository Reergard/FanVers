from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payouts", "0002_remove_tax_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="payoutprofile",
            name="verification_status",
            field=models.CharField(
                choices=[
                    ("draft", "Чернетка (не подано на перевірку)"),
                    ("pending", "Очікує перевірки"),
                    ("approved", "Підтверджено"),
                    ("rejected", "Відхилено"),
                    ("requires_more_info", "Потрібна додаткова інформація"),
                    ("cancelled", "Скасовано користувачем"),
                ],
                db_index=True,
                default="draft",
                max_length=32,
            ),
        ),
    ]
