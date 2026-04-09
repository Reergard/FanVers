from __future__ import annotations

import time
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Chapter, sanitize_chapter_html


class Command(BaseCommand):
    help = "Sanitize existing Chapter.html_content in DB and rewrite stored HTML files."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report how many chapters would change; do not write anything.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit number of chapters to process (useful for batching).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run: bool = bool(options.get("dry_run"))
        limit = options.get("limit")

        qs = Chapter.objects.exclude(html_content__isnull=True).exclude(html_content__exact="").order_by("id")
        if limit:
            qs = qs[: int(limit)]

        total = qs.count()
        changed = 0
        t0 = time.time()

        self.stdout.write(f"Chapters with html_content: {total}")

        for ch in qs.iterator(chunk_size=200):
            raw = ch.html_content or ""
            clean = sanitize_chapter_html(raw)
            if clean == raw:
                continue

            changed += 1
            if dry_run:
                continue

            with transaction.atomic():
                # Lock row to avoid overwriting concurrent updates.
                ch_locked = Chapter.objects.select_for_update().get(pk=ch.pk)
                # save_html_content оновлює html_content, лічильники та save() одним викликом.
                ch_locked.save_html_content(clean)

        elapsed = time.time() - t0
        if dry_run:
            self.stdout.write(self.style.WARNING(f"DRY RUN: would sanitize {changed}/{total} chapters"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Sanitized {changed}/{total} chapters in {elapsed:.1f}s"))

