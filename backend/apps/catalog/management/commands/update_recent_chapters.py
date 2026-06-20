from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.catalog.models import Chapter, _chapter_plain_text_len
from apps.catalog.services.content_utils import extract_plain_text
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Обновляет символы для глав, созданных после исправлений'

    def handle(self, *args, **options):
        # Глави з контентом (HTML або content_json), де лічильник ще нульовий
        chapters = Chapter.objects.filter(characters_count=0).filter(
            Q(html_content__isnull=False) & ~Q(html_content__exact="")
            | Q(content_json__isnull=False)
        )

        count = chapters.count()
        self.stdout.write(f'Найдено {count} глав для обновления символов')

        if count > 0:
            updated = 0

            for chapter in chapters:
                try:
                    if chapter.content_json:
                        # Те саме джерело, що rebuild_derived() / plain_text_length (не довжина HTML).
                        plain_len = len(extract_plain_text(chapter.content_json))
                    elif chapter.html_content:
                        plain_len = _chapter_plain_text_len(chapter.html_content)
                    else:
                        continue

                    chapter.character_count = plain_len
                    chapter.characters_count = plain_len
                    chapter.reading_time = int((plain_len / 1000) * 55) if plain_len else 0
                    chapter.min_reading_time = int(chapter.reading_time * 0.75) if chapter.reading_time else 0

                    chapter.save(
                        update_fields=[
                            "character_count",
                            "characters_count",
                            "reading_time",
                            "min_reading_time",
                        ]
                    )
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
