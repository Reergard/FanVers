from django.db import migrations, models


def forwards_migrate_log_locations(apps, schema_editor):
    AdvertisingLog = apps.get_model("monitoring", "AdvertisingLog")
    AdvertisingLog.objects.filter(location__in=["genres", "tags", "fandoms"]).update(
        location="search",
        target_kind="none",
        target_id=None,
    )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("monitoring", "0006_transactionlog_audit_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="advertisinglog",
            name="target_kind",
            field=models.CharField(
                choices=[
                    ("none", "Без таргету"),
                    ("genre", "Жанр"),
                    ("tag", "Тег"),
                    ("fandom", "Фендом"),
                ],
                default="none",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="advertisinglog",
            name="target_id",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(forwards_migrate_log_locations, backwards_noop),
        migrations.AlterField(
            model_name="advertisinglog",
            name="location",
            field=models.CharField(
                choices=[
                    ("main", "Реклама на Головній"),
                    ("catalog", "Реклама на Каталозі"),
                    ("search", "Реклама в пошуку"),
                ],
                max_length=20,
            ),
        ),
    ]
