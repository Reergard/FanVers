# Data migration: populate UserChapterAccess from profile.purchased_chapters

from django.db import migrations


def populate_from_purchased_chapters(apps, schema_editor):
    UserChapterAccess = apps.get_model('subscription', 'UserChapterAccess')
    Profile = apps.get_model('users', 'Profile')

    created = 0
    for profile in Profile.objects.prefetch_related('purchased_chapters').iterator(chunk_size=500):
        for chapter in profile.purchased_chapters.all():
            _, was_created = UserChapterAccess.objects.get_or_create(
                user_id=profile.user_id,
                chapter_id=chapter.id,
                defaults={
                    'book_id': chapter.book_id,
                    'source': 'balance_purchase',
                    'subscription_id': None,
                },
            )
            if was_created:
                created += 1


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('subscription', '0005_user_chapter_access'),
    ]

    operations = [
        migrations.RunPython(populate_from_purchased_chapters, noop),
    ]
