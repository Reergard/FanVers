import logging
import os
import time
from glob import glob

from celery import shared_task
from django.conf import settings

from apps.catalog.models import Chapter
from apps.catalog.services.content_utils import collect_referenced_chapter_image_rel_paths

logger = logging.getLogger(__name__)

TEMP_EDITOR_IMAGES_MAX_AGE_SEC = 24 * 3600


@shared_task
def cleanup_old_temp_editor_images():
    """Видаляє файли в media/tmp/editor-images/ старші за 24 год."""
    root = os.path.join(settings.MEDIA_ROOT, "tmp", "editor-images")
    if not os.path.isdir(root):
        return 0
    now = time.time()
    removed = 0
    for pattern in (os.path.join(root, "*", "*"),):
        for fp in glob(pattern):
            try:
                if os.path.isfile(fp) and now - os.path.getmtime(fp) > TEMP_EDITOR_IMAGES_MAX_AGE_SEC:
                    os.remove(fp)
                    removed += 1
            except OSError as e:
                logger.warning("cleanup_old_temp_editor_images: %s: %s", fp, e)
    for user_dir in glob(os.path.join(root, "*")):
        try:
            if os.path.isdir(user_dir) and not os.listdir(user_dir):
                os.rmdir(user_dir)
        except OSError:
            pass
    return removed


@shared_task
def cleanup_orphan_chapter_embedded_images():
    """
    Файли в media/books/*/chapters/images/, на які немає посилання з content_json жодної глави.
    """
    media_root = settings.MEDIA_ROOT
    media_url = getattr(settings, "MEDIA_URL", "/media/")
    referenced: set[str] = set()
    for ch in Chapter.objects.exclude(content_json__isnull=True).only("content_json"):
        if ch.content_json:
            referenced |= collect_referenced_chapter_image_rel_paths(ch.content_json, media_url)

    pattern = os.path.join(media_root, "books", "*", "chapters", "images", "*")
    removed = 0
    for fp in glob(pattern):
        try:
            if not os.path.isfile(fp):
                continue
            rel = os.path.relpath(fp, media_root).replace("\\", "/")
            if rel not in referenced:
                os.remove(fp)
                removed += 1
        except OSError as e:
            logger.warning("cleanup_orphan_chapter_embedded_images: %s: %s", fp, e)
    return removed
