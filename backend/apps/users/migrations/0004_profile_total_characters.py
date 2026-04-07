from django.db import migrations, models


def populate_total_characters(apps, schema_editor):
    """Backfill Profile.total_characters з актуальних characters_count глав.

    Запускається один раз при застосуванні міграції.
    Для кожного профілю агрегує characters_count по всіх главах книг власника.
    Також виправляє commission на основі нового total_characters.
    """
    from django.db.models import Sum
    from decimal import Decimal

    Profile = apps.get_model('users', 'Profile')
    Chapter = apps.get_model('catalog', 'Chapter')

    profiles = Profile.objects.select_related('user').all()
    updated_count = 0

    for profile in profiles.iterator(chunk_size=200):
        total = (
            Chapter.objects
            .filter(book__owner=profile.user)
            .aggregate(total=Sum('characters_count'))['total']
        ) or 0

        # Розраховуємо правильну комісію за новим total
        if total >= 10_000_000:
            correct_commission = Decimal('10.00')
        elif total >= 5_000_000:
            correct_commission = Decimal('12.00')
        else:
            correct_commission = Decimal('15.00')

        if profile.total_characters != total or profile.commission != correct_commission:
            Profile.objects.filter(pk=profile.pk).update(
                total_characters=total,
                commission=correct_commission,
            )
            updated_count += 1

    print(f'\n  populate_total_characters: оновлено {updated_count} профілів.')


def noop(apps, schema_editor):
    """Зворотна міграція не потребує дій — поле просто видаляється."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_profile_cookie_consent'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='total_characters',
            field=models.BigIntegerField(
                default=0,
                verbose_name='Загальна кількість символів',
                help_text=(
                    'Накопичена сума символів по всіх главах книг власника. '
                    'Оновлюється автоматично при збереженні/видаленні глав.'
                ),
            ),
        ),
        migrations.RunPython(populate_total_characters, noop),
    ]
