import os

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.catalog.models import Chapter


class Command(BaseCommand):
    help = "Конвертує існуючі глави з docx/html у content_json"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Лише перевірка, без змін у БД")
        parser.add_argument("--chapter-id", type=int, default=None, help="Мігрувати конкретну главу")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        chapter_id = options["chapter_id"]

        if chapter_id:
            chapters = Chapter.objects.filter(id=chapter_id)
        else:
            chapters = Chapter.objects.filter(content_json__isnull=True)

        total = chapters.count()
        self.stdout.write(f"Знайдено {total} глав для міграції")

        from apps.catalog.services.docx_to_json import docx_to_content_json
        from apps.catalog.services.html_to_json import html_to_content_json

        success_docx = 0
        success_html = 0
        errors = 0
        skipped = 0

        for chapter in chapters.select_related("book").iterator():
            try:
                if chapter.file and os.path.exists(chapter.file.path):
                    content_json = docx_to_content_json(
                        docx_path=chapter.file.path,
                        media_dir=settings.MEDIA_ROOT,
                        book_slug=chapter.book.slug,
                        chapter_slug=chapter.slug,
                    )
                    if not dry_run:
                        chapter.save_content(content_json)
                    success_docx += 1
                    self.stdout.write(f"  [DOCX] Chapter {chapter.id}: OK")

                elif chapter.html_content:
                    content_json = html_to_content_json(chapter.html_content)
                    if not dry_run:
                        chapter.save_content(content_json)
                    success_html += 1
                    self.stdout.write(f"  [HTML] Chapter {chapter.id}: OK")

                else:
                    skipped += 1
                    self.stdout.write(f"  [SKIP] Chapter {chapter.id}: немає даних")

            except Exception as e:
                errors += 1
                self.stderr.write(f"  [ERROR] Chapter {chapter.id}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nРезультат: {success_docx} з docx, {success_html} з html, "
                f"{skipped} пропущено, {errors} помилок"
            )
        )
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — нічого не змінено"))
