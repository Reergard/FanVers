# Migration: TransactionLog.chapter — nullable для підписок (покупка пакету без конкретної глави)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0003_advertising_batch_and_indexes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transactionlog',
            name='chapter',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to='catalog.chapter'
            ),
        ),
    ]
