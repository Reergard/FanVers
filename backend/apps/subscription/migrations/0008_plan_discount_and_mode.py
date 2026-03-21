# Subscription: discount_percent, discount_threshold, purchase_mode per plan
# Remove reliance on settings.allow_individual_purchase, price_per_chapter, discount

from decimal import Decimal
import django.core.validators
from django.db import migrations, models


def populate_plan_discount_fields(apps, schema_editor):
    """For existing plans: set discount_percent=0, discount_threshold=chapters_count, purchase_mode=prepaid."""
    BookSubscriptionPlan = apps.get_model('subscription', 'BookSubscriptionPlan')
    for plan in BookSubscriptionPlan.objects.all():
        plan.discount_percent = Decimal('0')
        plan.discount_threshold = plan.chapters_count
        plan.purchase_mode = 'prepaid'
        plan.save(update_fields=['discount_percent', 'discount_threshold', 'purchase_mode'])


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0007_allow_prepaid_and_instant'),
    ]

    operations = [
        migrations.AddField(
            model_name='booksubscriptionplan',
            name='discount_percent',
            field=models.DecimalField(
                max_digits=5,
                decimal_places=2,
                default=Decimal('0'),
                validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                verbose_name='Знижка %',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='booksubscriptionplan',
            name='discount_threshold',
            field=models.PositiveIntegerField(default=10, verbose_name='Поріг (від N розділів)'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='booksubscriptionplan',
            name='purchase_mode',
            field=models.CharField(
                choices=[('prepaid', 'Prepaid'), ('instant', 'Instant')],
                default='prepaid',
                max_length=20,
                db_index=True,
            ),
            preserve_default=False,
        ),
        migrations.RunPython(populate_plan_discount_fields, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='booksubscriptionplan',
            name='uniq_plan_chapters_per_settings',
        ),
        migrations.AddConstraint(
            model_name='booksubscriptionplan',
            constraint=models.UniqueConstraint(
                fields=['settings', 'discount_percent', 'discount_threshold', 'purchase_mode'],
                name='uniq_plan_discount_mode_per_settings',
            ),
        ),
    ]
