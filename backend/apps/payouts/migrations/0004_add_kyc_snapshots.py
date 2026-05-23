from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payouts", "0003_add_cancelled_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_country",
            field=models.CharField(blank=True, default="", max_length=2),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_full_name_legal",
            field=models.CharField(blank=True, default="", max_length=200),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_full_name_latin",
            field=models.CharField(blank=True, default="", max_length=200),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_address_line",
            field=models.CharField(blank=True, default="", max_length=300),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_city",
            field=models.CharField(blank=True, default="", max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="payoutrequest",
            name="snapshot_postal_code",
            field=models.CharField(blank=True, default="", max_length=20),
            preserve_default=False,
        ),
    ]
