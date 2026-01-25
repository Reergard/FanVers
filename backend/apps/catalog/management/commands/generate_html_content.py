from django.core.management.base import BaseCommand
from apps.catalog.models import Chapter
import mammoth
import os
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Генерирует HTML контент для глав, у которых его нет, и подсчитывает символы'

    def handle(self, *args, **options):
        # Находим все главы без HTML контента, но с файлами
        chapters = Chapter.objects.filter(
            html_content__isnull=True,
            file__isnull=False
        ).exclude(file='')
        
        count = chapters.count()
        self.stdout.write(f'Найдено {count} глав для генерации HTML контента')
        
        if count > 0:
            updated = 0
            errors = 0
            
            for chapter in chapters:
                try:
                    if chapter.file and os.path.exists(chapter.file.path):
                        with open(chapter.file.path, "rb") as docx_file:
                            result = mammoth.convert_to_html(docx_file)
                            html_content = result.value
                            chapter.save_html_content(html_content)
                            updated += 1
                            self.stdout.write(f'Обновлена глава: {chapter.title}')
                    else:
                        self.stdout.write(f'Файл не найден для главы: {chapter.title}')
                        errors += 1
                        
                except Exception as e:
                    logger.error(f"Ошибка при генерации HTML для главы {chapter.id}: {str(e)}")
                    self.stdout.write(f'Ошибка для главы {chapter.title}: {str(e)}')
                    errors += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'Успешно обновлено {updated} глав, ошибок: {errors}')
            )
        else:
            self.stdout.write('Нет глав для обновления')
