import hashlib
import logging
import uuid
from typing import Iterable, List, Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.html import escape

from .models import SupportTicket, SupportTicketAttachment

logger = logging.getLogger(__name__)

DUPLICATE_WINDOW_SECONDS = 600
MAX_ATTACHMENTS = 3
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_SUFFIXES = frozenset({".pdf", ".jpg", ".jpeg", ".png", ".webp"})

# Дозволені MIME (клієнт); порожній content-type / octet-stream не блокуємо, якщо пройшла перевірка «магії».
SUFFIX_TO_MIME = {
    ".pdf": frozenset({"application/pdf"}),
    ".jpg": frozenset({"image/jpeg"}),
    ".jpeg": frozenset({"image/jpeg"}),
    ".png": frozenset({"image/png"}),
    ".webp": frozenset({"image/webp"}),
}


class SupportAttachmentError(Exception):
    """Помилка валідації вкладень (для відповіді API з полем attachments)."""

    pass


def get_client_ip(request) -> Optional[str]:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45]
    ip = request.META.get("REMOTE_ADDR")
    return (ip or "")[:45] or None


def _dedupe_cache_key(email: str, message: str) -> str:
    key_src = f"{email.lower().strip()}|{message.strip().lower()}"
    digest = hashlib.sha256(key_src.encode("utf-8")).hexdigest()
    return f"support_ticket_dup:{digest}"


def is_duplicate_submission(email: str, message: str) -> bool:
    return bool(cache.get(_dedupe_cache_key(email, message)))


def mark_submission_dedupe(email: str, message: str) -> None:
    cache.set(_dedupe_cache_key(email, message), 1, DUPLICATE_WINDOW_SECONDS)


def notify_staff_new_ticket(ticket: SupportTicket) -> None:
    User = get_user_model()
    qs = User.objects.filter(is_active=True).filter(
        Q(is_staff=True) | Q(is_superuser=True)
    ).exclude(email__exact="")
    recipients = list(qs.values_list("email", flat=True).distinct())
    if not recipients:
        logger.warning("Support ticket %s: no staff emails for notification", ticket.ticket_number)
        return
    subject = f"[{ticket.ticket_number}] Нове звернення: {ticket.subject[:80]}"
    body_lines = [
        f"Номер: {ticket.ticket_number}",
        f"Категорія: {ticket.get_category_display()}",
        f"Тема: {ticket.subject}",
        f"Email: {ticket.email}",
        f"Ім'я: {ticket.name}",
        f"Користувач: {ticket.user_id or '—'}",
        f"IP: {ticket.ip_address or '—'}",
        f"Джерело: {ticket.source}",
        "",
        escape(ticket.message),
    ]
    body = "\n".join(body_lines)
    from_addr = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "noreply@localhost"
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_addr,
            recipient_list=recipients,
            fail_silently=False,
        )
    except Exception:
        logger.exception("Failed to send staff notification for ticket %s", ticket.ticket_number)


def delete_attachment_files(attachments: List[SupportTicketAttachment]) -> None:
    """
    Після rollback транзакції рядок у БД зазвичай зникає; файл на диску може лишитись.
    Спочатку прибираємо файл, потім пробуємо видалити рядок (idempotent, якщо рядка вже немає).
    """
    for att in attachments:
        pk = getattr(att, "pk", None)
        try:
            if att.file:
                att.file.delete(save=False)
        except Exception:
            logger.warning("Не вдалося прибрати тимчасовий файл вкладення", exc_info=True)
        if pk:
            try:
                SupportTicketAttachment.objects.filter(pk=pk).delete()
            except Exception:
                logger.warning("Не вдалося прибрати запис вкладення pk=%s", pk, exc_info=True)


def _file_suffix(filename: str) -> str:
    name = (filename or "").lower()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1]


def _validate_magic_and_mime(uploaded, suffix: str) -> None:
    """Перевірка початку файлу та (за наявності) Content-Type."""
    uploaded.seek(0)
    head = uploaded.read(64)
    uploaded.seek(0)
    if len(head) < 4:
        raise SupportAttachmentError("Файл пошкоджений або порожній.")

    if suffix == ".pdf":
        if not head.startswith(b"%PDF"):
            raise SupportAttachmentError("Вміст не відповідає формату PDF.")
    elif suffix in (".jpg", ".jpeg"):
        if not head.startswith(b"\xff\xd8\xff"):
            raise SupportAttachmentError("Вміст не відповідає формату JPEG.")
    elif suffix == ".png":
        if not head.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SupportAttachmentError("Вміст не відповідає формату PNG.")
    elif suffix == ".webp":
        if len(head) < 12 or head[:4] != b"RIFF" or head[8:12] != b"WEBP":
            raise SupportAttachmentError("Вміст не відповідає формату WEBP.")

    ct_raw = getattr(uploaded, "content_type", "") or ""
    ct = ct_raw.lower().split(";")[0].strip()
    allowed_m = SUFFIX_TO_MIME.get(suffix, frozenset())
    if ct and ct != "application/octet-stream" and allowed_m and ct not in allowed_m:
        raise SupportAttachmentError("Тип файлу (Content-Type) не збігається з дозволеним.")


def support_attachment_storage_name(original_filename: str) -> str:
    """Безпечне ім'я на диску: UUID + дозволений суфікс (оригінал лише в original_name)."""
    suffix = _file_suffix(original_filename)
    if suffix not in ALLOWED_ATTACHMENT_SUFFIXES:
        suffix = ""
    ext = suffix if suffix else ""
    return f"{uuid.uuid4().hex}{ext}"


def save_attachments(
    ticket: SupportTicket,
    files: Iterable,
) -> List[SupportTicketAttachment]:
    raw_list = list(files)
    if len(raw_list) > MAX_ATTACHMENTS:
        raise SupportAttachmentError(
            f"Завантажте не більше {MAX_ATTACHMENTS} файлів одночасно."
        )

    attachments: List[SupportTicketAttachment] = []
    for f in raw_list:
        if not f or not getattr(f, "name", None):
            continue
        suffix = _file_suffix(f.name)
        if suffix not in ALLOWED_ATTACHMENT_SUFFIXES:
            delete_attachment_files(attachments)
            raise SupportAttachmentError(
                f"Недозволений тип файлу: {suffix or f.name}"
            )
        if getattr(f, "size", 0) > MAX_ATTACHMENT_BYTES:
            delete_attachment_files(attachments)
            raise SupportAttachmentError("Файл завеликий (макс. 5 МБ).")

        _validate_magic_and_mime(f, suffix)

        storage_name = support_attachment_storage_name(f.name)
        att = SupportTicketAttachment(
            ticket=ticket,
            original_name=getattr(f, "name", "")[:255],
        )
        att.file.save(storage_name, f, save=False)
        att.save()
        attachments.append(att)

    return attachments
