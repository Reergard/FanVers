from django.core.management.base import BaseCommand
from apps.catalog.models import Chapter


class Command(BaseCommand):
    help = 'Обновляет поле characters_count для существующих глав на основе character_count'

    def handle(self, *args, **options):
        # Находим все главы где characters_count = 0 но character_count > 0
        chapters_to_update = Chapter.objects.filter(
            characters_count=0,
            character_count__gt=0
        )
        
        count = chapters_to_update.count()
        self.stdout.write(f'Найдено {count} глав для обновления characters_count')
        
        if count > 0:
            # Обновляем characters_count на основе character_count
            updated = 0
            for chapter in chapters_to_update:
                chapter.characters_count = chapter.character_count
                chapter.save(update_fields=['characters_count'])
                updated += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'Успешно обновлено {updated} глав')
            )
        else:
            self.stdout.write('Нет глав для обновления')
