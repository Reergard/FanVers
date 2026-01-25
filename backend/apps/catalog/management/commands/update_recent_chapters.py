from django.core.management.base import BaseCommand
from apps.catalog.models import Chapter
import mammoth
import os
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Обновляет символы для глав, созданных после исправлений'

    def handle(self, *args, **options):
        # Находим все главы с HTML контентом, но без подсчитанных символов
        chapters = Chapter.objects.filter(
            html_content__isnull=False,
            characters_count=0
        )
        
        count = chapters.count()
        self.stdout.write(f'Найдено {count} глав для обновления символов')
        
        if count > 0:
            updated = 0
            
            for chapter in chapters:
                try:
                    if chapter.html_content:
                        # Обновляем поля символов
                        chapter.character_count = len(chapter.html_content)
                        chapter.characters_count = len(chapter.html_content)
                        
                        # Пересчитываем время чтения
                        chapter.reading_time = (chapter.character_count / 1000) * 180
                        chapter.min_reading_time = chapter.reading_time * 0.75
                        
                        chapter.save(update_fields=['character_count', 'characters_count', 'reading_time', 'min_reading_time'])
                        updated += 1
                        self.stdout.write(f'Обновлена глава: {chapter.title} - {chapter.characters_count} символов')
                        
                except Exception as e:
                    logger.error(f"Ошибка при обновлении главы {chapter.id}: {str(e)}")
                    self.stdout.write(f'Ошибка для главы {chapter.title}: {str(e)}')
            
            self.stdout.write(
                self.style.SUCCESS(f'Успешно обновлено {updated} глав')
            )
        else:
            self.stdout.write('Нет глав для обновления')
