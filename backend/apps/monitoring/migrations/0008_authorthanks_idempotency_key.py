# Generated manually for author thanks idempotency

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("monitoring", "0007_advertisinglog_search_targeting"),
    ]

    operations = [
        migrations.AddField(
            model_name="authorthanks",
            name="idempotency_key",
            field=models.CharField(
                blank=True,
                help_text="Унікальний ключ з клієнта; повтор з тим самим ключем не списує баланс повторно.",
                max_length=64,
                null=True,
                verbose_name="Ключ ідемпотентності",
            ),
        ),
        migrations.AddConstraint(
            model_name="authorthanks",
            constraint=models.UniqueConstraint(
                condition=Q(idempotency_key__isnull=False) & ~Q(idempotency_key=""),
                fields=("giver", "idempotency_key"),
                name="monitoring_authorthanks_giver_idem_uniq",
            ),
        ),
    ]
