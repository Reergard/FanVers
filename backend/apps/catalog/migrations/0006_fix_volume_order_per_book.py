# Fix Volume.order to be per-book (was set globally by id in 0004)

from django.db import migrations


def fix_volume_order(apps, schema_editor):
    Volume = apps.get_model('catalog', 'Volume')
    from collections import defaultdict
    by_book = defaultdict(list)
    for vol in Volume.objects.order_by('book_id', 'id'):
        by_book[vol.book_id].append(vol)
    for vols in by_book.values():
        for i, vol in enumerate(vols, start=1):
            vol.order = i
            vol.save(update_fields=['order'])


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0005_remove_chapter_position'),
    ]

    operations = [
        migrations.RunPython(fix_volume_order, migrations.RunPython.noop),
    ]
