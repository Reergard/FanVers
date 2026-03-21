from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0005_alter_transactionlog_chapter'),
    ]

    operations = [
        migrations.AddField(
            model_name='transactionlog',
            name='audit_metadata',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
