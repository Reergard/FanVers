from django.db import migrations, models


def sync_existing_profiles(apps, schema_editor):
    Profile = apps.get_model("users", "Profile")
    Profile.objects.filter(hide_adult_content=False, age_confirmed=False).update(age_confirmed=True)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="age_confirmed",
            field=models.BooleanField(default=True, verbose_name="Підтверджено вік 18+"),
        ),
        migrations.RunPython(sync_existing_profiles, migrations.RunPython.noop),
    ]

