# Generated manually for search targeting

from django.db import migrations, models


def forwards_migrate_old_locations(apps, schema_editor):
    Advertisement = apps.get_model("website_advertising", "Advertisement")
    Advertisement.objects.filter(location__in=["genres", "tags", "fandoms"]).update(
        location="search",
        target_kind="none",
        target_id=None,
    )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("website_advertising", "0002_advertising_batch_and_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="advertisement",
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
            model_name="advertisement",
            name="target_id",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(forwards_migrate_old_locations, backwards_noop),
        migrations.AlterField(
            model_name="advertisement",
            name="location",
            field=models.CharField(
                choices=[
                    ("main", "Головна сторінка"),
                    ("catalog", "Каталог"),
                    ("search", "Пошук"),
                ],
                max_length=20,
            ),
        ),
        migrations.RemoveIndex(
            model_name="advertisement",
            name="website_adv_book_id_405dec_idx",
        ),
        migrations.RemoveIndex(
            model_name="advertisement",
            name="website_adv_locatio_eae3be_idx",
        ),
        migrations.AddIndex(
            model_name="advertisement",
            index=models.Index(
                fields=["book", "location", "target_kind", "start_date", "end_date"],
                name="website_adv_book_loc_tg_d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="advertisement",
            index=models.Index(
                fields=["location", "target_kind", "start_date", "end_date"],
                name="website_adv_loc_tg_dates_idx",
            ),
        ),
    ]
