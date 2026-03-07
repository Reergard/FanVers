# Data migration: populate order from _position, create containers

from django.db import migrations


def populate_order(apps, schema_editor):
    Chapter = apps.get_model('catalog', 'Chapter')
    Volume = apps.get_model('catalog', 'Volume')
    ChapterOrderContainer = apps.get_model('catalog', 'ChapterOrderContainer')
    Book = apps.get_model('catalog', 'Book')

    # Volume.order: per book, by id (stable)
    from collections import defaultdict
    by_book = defaultdict(list)
    for vol in Volume.objects.order_by('book_id', 'id'):
        by_book[vol.book_id].append(vol)
    for vols in by_book.values():
        for i, vol in enumerate(vols, start=1):
            vol.order = i
            vol.save(update_fields=['order'])

    # Chapter.order: per container (book, volume), sort by _position then id
    from collections import defaultdict
    from decimal import Decimal
    by_container = defaultdict(list)
    for ch in Chapter.objects.select_related('book', 'volume').order_by('book_id', 'volume_id'):
        vid = ch.volume_id if ch.volume_id else None
        key = (ch.book_id, vid)
        by_container[key].append(ch)

    for (book_id, volume_id), chapters in by_container.items():
        # Sort by _position (asc), then id for stable order
        def sort_key(c):
            pos = c._position
            p = float(pos) if pos is not None else 0.0
            return (p, c.id)
        chapters.sort(key=sort_key)
        for i, ch in enumerate(chapters, start=1):
            ch.order = i
            ch.save(update_fields=['order'])

    # Create ChapterOrderContainer for each container
    containers_seen = set()
    for ch in Chapter.objects.select_related('book', 'volume'):
        key = (ch.book_id, ch.volume_id)
        if key in containers_seen:
            continue
        containers_seen.add(key)
        book = ch.book
        volume = ch.volume
        ChapterOrderContainer.objects.get_or_create(
            book=book,
            volume=volume,
            defaults={'version': 1},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0003_chapter_order_refactor'),
    ]

    operations = [
        migrations.RunPython(populate_order, noop),
    ]
