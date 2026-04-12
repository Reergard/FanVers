"""
Тимчасове збереження завантаженого .docx для конвертації без збереження у Chapter.file.
"""

import logging
import os
import tempfile

logger = logging.getLogger(__name__)


def write_uploaded_docx_to_temp(uploaded_file) -> str:
    """
    Записує UploadedFile у тимчасовий .docx. Викликайте os.unlink(path) після конвертації.
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
    try:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        tmp.flush()
        path = tmp.name
    finally:
        tmp.close()
    return path


def clear_chapter_docx_filefields(chapter) -> list[str]:
    """
    Обнуляє поля file / original_file / original_file_type у БД (save).
    Повертає список абсолютних шляхів файлів для видалення ПІСЛЯ коміту транзакції.
    """
    paths_to_delete: list[str] = []
    for attr in ("file", "original_file"):
        field_file = getattr(chapter, attr, None)
        if not field_file:
            continue
        try:
            p = field_file.path
            if p and p not in paths_to_delete:
                paths_to_delete.append(p)
        except ValueError:
            pass
        setattr(chapter, attr, None)

    if chapter.original_file_type:
        chapter.original_file_type = ""
    chapter.save(update_fields=["file", "original_file", "original_file_type"])
    return paths_to_delete


def delete_files_on_disk(paths: list[str]) -> None:
    """Видаляє файли з диску. Безпечно ігнорує відсутні."""
    for p in paths:
        try:
            if os.path.isfile(p):
                os.remove(p)
        except OSError as e:
            logger.warning("Could not delete file %s: %s", p, e)
