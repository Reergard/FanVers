# Subscription: price_per_chapter, discount, constraints

from decimal import Decimal
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='booksubscriptionsettings',
            name='price_per_chapter',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                verbose_name='Вартість за 1 розділ (FanCoins)',
            ),
        ),
        migrations.AddField(
            model_name='booksubscriptionsettings',
            name='discount_percent',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                max_digits=5,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                verbose_name='Знижка %',
            ),
        ),
        migrations.AddField(
            model_name='booksubscriptionsettings',
            name='discount_threshold',
            field=models.PositiveIntegerField(default=10, verbose_name='Поріг знижки (від N розділів)'),
        ),
        migrations.AddConstraint(
            model_name='userbooksubscription',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    status='active',
                    purchase_mode='prepaid',
                    remaining_chapters_count__gt=0,
                ),
                fields=('user', 'book'),
                name='uniq_active_prepaid_per_user_book',
            ),
        ),
        migrations.AddConstraint(
            model_name='userbooksubscriptionusage',
            constraint=models.UniqueConstraint(
                condition=models.Q(chapter__isnull=False),
                fields=('subscription', 'chapter'),
                name='uniq_subscription_chapter_usage',
            ),
        ),
    ]
