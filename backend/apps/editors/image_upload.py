"""Спільна валідація зображень редактора та ліміти завантажень."""

from io import BytesIO
from time import time

from django.core.cache import cache
from PIL import Image as PILImage

ALLOWED_EDITOR_IMAGE_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/gif", "image/webp"}
)
MAX_EDITOR_IMAGE_BYTES = 5 * 1024 * 1024

_EXT_MAP = {"JPEG": "jpg", "JPG": "jpg", "PNG": "png", "GIF": "gif", "WEBP": "webp"}

TEMP_UPLOAD_WINDOW_SEC = 600
TEMP_UPLOAD_MAX_PER_WINDOW = 20
TEMP_UPLOAD_CACHE_PREFIX = "edtmpimg"


def validate_editor_image_raw(raw: bytes) -> tuple[str | None, str | None]:
    """
    Повертає (ext, None) при успіху або (None, повідомлення_помилки).
    """
    if len(raw) > MAX_EDITOR_IMAGE_BYTES:
        return None, "Макс. розмір зображення — 5 МБ"
    try:
        img = PILImage.open(BytesIO(raw))
        img.verify()
        img = PILImage.open(BytesIO(raw))
        img.load()
        fmt = (img.format or "PNG").upper()
    except Exception:
        return None, "Файл не є валідним зображенням"
    ext = _EXT_MAP.get(fmt, "png")
    return ext, None


def check_temp_editor_upload_rate(user_id: int) -> bool:
    """True — можна завантажити, False — перевищено ліміт (20 / 10 хв)."""
    bucket = int(time() // TEMP_UPLOAD_WINDOW_SEC)
    key = f"{TEMP_UPLOAD_CACHE_PREFIX}:{user_id}:{bucket}"
    try:
        n = cache.incr(key)
    except ValueError:
        cache.add(key, 1, timeout=TEMP_UPLOAD_WINDOW_SEC + 60)
        n = 1
    return n <= TEMP_UPLOAD_MAX_PER_WINDOW
