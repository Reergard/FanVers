from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("payouts", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="payoutprofile",
            name="legal_status",
        ),
        migrations.RemoveField(
            model_name="payoutprofile",
            name="tax_residency_country",
        ),
        migrations.RemoveField(
            model_name="payoutprofile",
            name="tax_id",
        ),
        migrations.RemoveField(
            model_name="payoutprofile",
            name="tax_residency_certificate",
        ),
    ]
