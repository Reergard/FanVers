import logging

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.catalog.abandoned_thresholds import (
    ABANDONED_TOTAL_DAYS,
    ABANDONED_WARNING_AFTER_DAYS,
    thresholds_use_minutes,
    total_inactivity_delta,
    warning_inactivity_delta,
)
from apps.catalog.models import Book
from .models import Notification

logger = logging.getLogger(__name__)


def _warning_message(book):
    remaining = max(0, ABANDONED_TOTAL_DAYS - ABANDONED_WARNING_AFTER_DAYS)
    if thresholds_use_minutes():
        period = f"{remaining} хвилин"
    else:
        period = f"{remaining} днів"
    return (
        f'Переклад «{book.title}»: якщо протягом {period} не буде активності, '
        f'його буде перенесено в «Покинуті».'
    )


def _abandon_message(book):
    return (
        f'Переклад «{book.title}» перенесено в «Покинуті»; ви більше не вказані як власник.'
    )


def _send_abandoned_warnings_impl():
    """
    Попередження лише у «вікні» 25–30 днів (у dev — 25–30 хв): вже ≥25, але ще <30 до переносу.
    Якщо неактивність уже ≥30 — попередження не шлемо (лише перенос у другому кроці).
    Ідемпотентність: abandoned_warning_sent_at is null.
    """
    now = timezone.now()
    warn_cutoff = now - warning_inactivity_delta()  # 25d: активність старіша за це → ≥25d бездіяльності
    abandon_cutoff = now - total_inactivity_delta()  # 30d: строга межа переносу
    candidate_ids = list(
        Book.objects.filter(
            book_type='TRANSLATION',
            translation_status='TRANSLATING',
            owner__isnull=False,
            owner_last_activity_at__lte=warn_cutoff,
            owner_last_activity_at__gt=abandon_cutoff,
            abandoned_warning_sent_at__isnull=True,
        ).values_list('id', flat=True)
    )
    for book_id in candidate_ids:
        try:
            with transaction.atomic():
                book = Book.objects.select_for_update().get(pk=book_id)
                if (
                    book.book_type != 'TRANSLATION'
                    or book.translation_status != 'TRANSLATING'
                    or not book.owner_id
                    or book.abandoned_warning_sent_at is not None
                ):
                    continue
                if (
                    not book.owner_last_activity_at
                    or book.owner_last_activity_at > warn_cutoff
                    or book.owner_last_activity_at <= abandon_cutoff
                ):
                    continue
                owner = book.owner
                Notification.objects.create(
                    user=owner,
                    book=book,
                    message=_warning_message(book),
                )
                book.abandoned_warning_sent_at = now
                book.save(update_fields=['abandoned_warning_sent_at'])
        except Exception:
            logger.exception(
                'send_abandoned_notification failed for book_id=%s',
                book_id,
            )


def _abandon_inactive_translations_impl():
    """
    Перенос у ABANDONED після повної неактивності власника (30 днів / 30 хв у dev).
    """
    threshold = timezone.now() - total_inactivity_delta()
    candidate_ids = list(
        Book.objects.filter(
            book_type='TRANSLATION',
            translation_status='TRANSLATING',
            owner__isnull=False,
            owner_last_activity_at__lte=threshold,
        ).values_list('id', flat=True)
    )
    for book_id in candidate_ids:
        try:
            with transaction.atomic():
                book = Book.objects.select_for_update().get(pk=book_id)
                if (
                    book.book_type != 'TRANSLATION'
                    or book.translation_status != 'TRANSLATING'
                    or not book.owner_id
                ):
                    continue
                if not book.owner_last_activity_at or book.owner_last_activity_at > threshold:
                    continue
                owner = book.owner
                Notification.objects.create(
                    user=owner,
                    book=book,
                    message=_abandon_message(book),
                )
                book.translation_status = 'ABANDONED'
                book.owner = None
                book.abandoned_warning_sent_at = None
                book.save(update_fields=['translation_status', 'owner', 'abandoned_warning_sent_at'])
        except Exception:
            logger.exception(
                'check_abandoned_books failed for book_id=%s',
                book_id,
            )


@shared_task
def send_abandoned_notification():
    _send_abandoned_warnings_impl()


@shared_task
def check_abandoned_books():
    """
    Спочатку попередження, потім перенос (гарантований порядок в одному циклі beat).
    """
    _send_abandoned_warnings_impl()
    _abandon_inactive_translations_impl()
