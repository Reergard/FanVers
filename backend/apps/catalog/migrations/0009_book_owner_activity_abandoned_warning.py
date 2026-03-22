# Generated manually for owner activity tracking on translations.

from django.db import migrations, models


def forwards_fill_owner_activity(apps, schema_editor):
    Book = apps.get_model('catalog', 'Book')
    qs = Book.objects.filter(book_type='TRANSLATION').exclude(owner_id=None)
    for row in qs.iterator(chunk_size=500):
        ts = row.last_updated or row.created_at
        Book.objects.filter(pk=row.id).update(owner_last_activity_at=ts)


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0008_chapter_created_at_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='owner_last_activity_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Активність власника (переклад)',
            ),
        ),
        migrations.AddField(
            model_name='book',
            name='abandoned_warning_sent_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Попередження про Покинуті надіслано',
            ),
        ),
        migrations.RunPython(forwards_fill_owner_activity, backwards_noop),
    ]
