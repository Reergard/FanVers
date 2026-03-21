# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0006_populate_user_chapter_access'),
    ]

    operations = [
        migrations.AddField(
            model_name='booksubscriptionsettings',
            name='allow_prepaid_pack',
            field=models.BooleanField(default=True, verbose_name='Дозволити покупку пакету (prepaid)'),
        ),
        migrations.AddField(
            model_name='booksubscriptionsettings',
            name='allow_instant_apply',
            field=models.BooleanField(default=True, verbose_name='Дозволити миттєву покупку обраних розділів'),
        ),
    ]
