# Generated manually for subscription app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('catalog', '0007_advertising_batch_and_indexes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BookSubscriptionSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=False, verbose_name='Підписка увімкнена')),
                ('allow_individual_purchase', models.BooleanField(default=True, verbose_name='Дозволити покупку окремих розділів')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('book', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_settings', to='catalog.book')),
            ],
            options={
                'verbose_name': 'Налаштування підписки книги',
                'verbose_name_plural': 'Налаштування підписок книг',
            },
        ),
        migrations.CreateModel(
            name='BookSubscriptionPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chapters_count', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)], verbose_name='Кількість розділів')),
                ('price', models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Ціна (FanCoins)')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активний')),
                ('sort_order', models.PositiveIntegerField(default=0, verbose_name='Порядок')),
                ('settings', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plans', to='subscription.booksubscriptionsettings')),
            ],
            options={
                'verbose_name': 'План підписки',
                'verbose_name_plural': 'Плани підписки',
                'ordering': ['sort_order', 'chapters_count'],
            },
        ),
        migrations.CreateModel(
            name='UserBookSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('purchased_chapters_count', models.PositiveIntegerField(verbose_name='Кількість розділів у пакеті (snapshot)')),
                ('remaining_chapters_count', models.PositiveIntegerField(default=0, verbose_name='Залишок розділів')),
                ('price_paid', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Оплачено (FanCoins, snapshot)')),
                ('status', models.CharField(choices=[('active', 'Активний'), ('exhausted', 'Вичерпано'), ('expired', 'Закінчився'), ('cancelled', 'Скасовано')], db_index=True, default='active', max_length=20)),
                ('purchase_mode', models.CharField(choices=[('prepaid', 'Prepaid'), ('instant_selected', 'Instant selected')], db_index=True, max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_subscriptions', to='catalog.book')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='user_subscriptions', to='subscription.booksubscriptionplan')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='book_subscriptions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Підписка користувача на книгу',
                'verbose_name_plural': 'Підписки користувачів на книги',
            },
        ),
        migrations.CreateModel(
            name='SubscriptionOperation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('operation_type', models.CharField(db_index=True, max_length=50)),
                ('idempotency_key', models.CharField(db_index=True, max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('payload_snapshot', models.JSONField(blank=True, null=True)),
                ('result_snapshot', models.JSONField(blank=True, null=True)),
                ('error_code', models.CharField(blank=True, max_length=50, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_operations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Операція підписки',
                'verbose_name_plural': 'Операції підписок',
            },
        ),
        migrations.CreateModel(
            name='UserBookSubscriptionUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('usage_type', models.CharField(choices=[('consume', 'Consume'), ('bulk_apply', 'Bulk apply'), ('adjustment_refund', 'Adjustment refund'), ('adjustment_restore', 'Adjustment restore')], max_length=30)),
                ('source', models.CharField(choices=[('chapter_buy_button', 'Chapter buy button'), ('bulk_apply_request', 'Bulk apply request'), ('admin_panel', 'Admin panel'), ('support_fix', 'Support fix')], max_length=30)),
                ('chapters_consumed', models.PositiveIntegerField(default=1)),
                ('remaining_after', models.PositiveIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('chapter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subscription_usages', to='catalog.chapter')),
                ('subscription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usages', to='subscription.userbooksubscription')),
            ],
            options={
                'verbose_name': 'Використання підписки',
                'verbose_name_plural': 'Використання підписок',
            },
        ),
        migrations.AddConstraint(
            model_name='booksubscriptionplan',
            constraint=models.UniqueConstraint(fields=('settings', 'chapters_count'), name='uniq_plan_chapters_per_settings'),
        ),
        migrations.AddConstraint(
            model_name='subscriptionoperation',
            constraint=models.UniqueConstraint(fields=('user', 'operation_type', 'idempotency_key'), name='uniq_subscription_idempotency'),
        ),
    ]
