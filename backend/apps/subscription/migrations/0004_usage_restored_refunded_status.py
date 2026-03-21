# Subscription: restored_at, remove uniq constraint

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0003_admin_audit_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='userbooksubscriptionusage',
            name='restored_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Відновлено (restore)'),
        ),
        migrations.RemoveConstraint(
            model_name='userbooksubscriptionusage',
            name='uniq_subscription_chapter_usage',
        ),
    ]
