# Remove _position, add unique constraints for chapter order

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0004_populate_chapter_order'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='chapter',
            name='_position',
        ),
        migrations.AddConstraint(
            model_name='chapter',
            constraint=models.UniqueConstraint(
                condition=models.Q(('volume__isnull', False)),
                fields=('book', 'volume', 'order'),
                name='uniq_chapter_order_in_volume',
            ),
        ),
        migrations.AddConstraint(
            model_name='chapter',
            constraint=models.UniqueConstraint(
                condition=models.Q(('volume__isnull', True)),
                fields=('book', 'order'),
                name='uniq_chapter_order_no_volume',
            ),
        ),
    ]
