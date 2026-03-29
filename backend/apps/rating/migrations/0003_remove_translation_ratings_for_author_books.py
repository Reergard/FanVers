# Data migration: TRANSLATION ratings are invalid for AUTHOR books.

from django.db import migrations


def remove_invalid_translation_ratings(apps, schema_editor):
    BookRating = apps.get_model("rating", "BookRating")
    BookRating.objects.filter(
        rating_type="TRANSLATION",
        book__book_type="AUTHOR",
    ).delete()


def recompute_analytics_totals(apps, schema_editor):
    """Перерахунок BookAnalytics з джерел після видалення помилкових рядків."""
    from apps.analytics_books.services.rebuild import recompute_book_analytics_totals

    recompute_book_analytics_totals()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("rating", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(remove_invalid_translation_ratings, noop_reverse),
        migrations.RunPython(recompute_analytics_totals, noop_reverse),
    ]
