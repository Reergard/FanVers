import logging
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.catalog.models import Chapter

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Генерує контент для глав без content_json, але з файлом .docx (python-docx → save_content)"

    def handle(self, *args, **options):
        chapters = Chapter.objects.filter(content_json__isnull=True, file__isnull=False).exclude(file="")

        count = chapters.count()
        self.stdout.write(f"Знайдено {count} глав для генерації контенту")

        if count > 0:
            updated = 0
            errors = 0
            from apps.catalog.services.docx_to_json import docx_to_content_json

            for chapter in chapters.select_related("book"):
                try:
                    if chapter.file and os.path.exists(chapter.file.path):
                        content_json = docx_to_content_json(
                            docx_path=chapter.file.path,
                            media_dir=settings.MEDIA_ROOT,
                            book_slug=chapter.book.slug,
                            chapter_slug=chapter.slug,
                        )
                        chapter.save_content(content_json)
                        updated += 1
                        self.stdout.write(f"Оновлено: {chapter.title}")
                    else:
                        self.stdout.write(f"Файл не знайдено: {chapter.title}")
                        errors += 1

                except Exception as e:
                    logger.error("Помилка generate_html_content для глави %s: %s", chapter.id, str(e))
                    self.stdout.write(f"Помилка для {chapter.title}: {str(e)}")
                    errors += 1

            self.stdout.write(
                self.style.SUCCESS(f"Успішно оновлено {updated} глав, помилок: {errors}")
            )
        else:
            self.stdout.write("Немає глав для оновлення")
