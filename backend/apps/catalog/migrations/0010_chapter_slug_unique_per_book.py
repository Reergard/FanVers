"""
Змінює унікальність slug глави:
  - Було: глобальний unique індекс на поле slug (catalog_chapter_slug_key)
  - Стало: UniqueConstraint(book, slug) — унікальність лише в межах однієї книги

Причина: глави різних книг можуть мати однакові назви (і slug),
наприклад "Глава 10" → slug="10" в книзі А та книзі Б.
URL вже завжди складовий /books/<book_slug>/chapters/<chapter_slug>/,
тому глобальна унікальність slug зайва і призводить до помилок при завантаженні.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0009_book_owner_activity_abandoned_warning'),
    ]

    operations = [
        # 1. Знімаємо unique=True з поля slug (видаляє глобальний індекс catalog_chapter_slug_key)
        migrations.AlterField(
            model_name='chapter',
            name='slug',
            field=models.SlugField(blank=True, unique=False),
        ),
        # 2. Додаємо UniqueConstraint(book, slug) — унікальність в межах книги
        migrations.AddConstraint(
            model_name='chapter',
            constraint=models.UniqueConstraint(
                fields=['book', 'slug'],
                name='uniq_chapter_slug_per_book',
            ),
        ),
    ]
