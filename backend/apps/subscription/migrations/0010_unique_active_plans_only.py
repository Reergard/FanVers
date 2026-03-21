# UniqueConstraint тільки для активних планів — щоб можна було створити той самий план після «видалення»

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0009_price_optional'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='booksubscriptionplan',
            name='uniq_plan_discount_mode_per_settings',
        ),
        migrations.AddConstraint(
            model_name='booksubscriptionplan',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True),
                fields=('settings', 'discount_percent', 'discount_threshold', 'purchase_mode'),
                name='uniq_active_plan_params',
            ),
        ),
    ]
