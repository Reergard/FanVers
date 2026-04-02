from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_age_confirmed_default_true"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="cookie_consent",
            field=models.JSONField(blank=True, null=True, verbose_name="Cookie consent"),
        ),
    ]

