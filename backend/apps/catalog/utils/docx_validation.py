from __future__ import annotations

from typing import Optional


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOCX_MAGIC = b"PK\x03\x04"  # zip local file header
MAX_DOCX_SIZE_BYTES = 10 * 1024 * 1024


def validate_docx_file(uploaded_file) -> Optional[str]:
    """
    Validates an uploaded chapter file as DOCX.

    Returns:
        None if valid, otherwise an error message string.
    """
    if uploaded_file is None:
        return "Файл розділу обов'язковий"

    name = getattr(uploaded_file, "name", "") or ""
    if not name.lower().endswith(".docx"):
        return "Дозволено завантажувати лише файли .docx"

    size = getattr(uploaded_file, "size", None)
    if isinstance(size, int) and size > MAX_DOCX_SIZE_BYTES:
        return "Файл занадто великий (макс 10MB)"

    content_type = getattr(uploaded_file, "content_type", None)
    if content_type != DOCX_MIME:
        return "Некоректний MIME-тип файлу (очікується DOCX)"

    try:
        head = uploaded_file.read(4)
        if head != DOCX_MAGIC:
            return "Некоректний формат файлу (magic bytes не відповідають DOCX)"
    except Exception:
        return "Не вдалося прочитати файл для перевірки"
    finally:
        try:
            uploaded_file.seek(0)
        except Exception:
            # If we cannot rewind, treat as invalid to avoid partial reads later.
            return "Не вдалося скинути позицію читання файлу"

    return None

