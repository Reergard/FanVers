import logging

from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .models import CommentLikeAnalyticsEvent, DailyAnalytics
from .services.rebuild import run_full_analytics_repair

logger = logging.getLogger(__name__)


@shared_task(ignore_result=False)
def repair_analytics_from_sources(days: int = 90):
    """
    Нічний/фоновий перерахунок: BookAnalytics з джерел правди + денні метрики
    (comment_likes по днях — з CommentLikeAnalyticsEvent).
    """
    try:
        stats = run_full_analytics_repair(days=days)
        msg = f"repair_analytics_from_sources: {stats}"
        logger.info(msg)
        return msg
    except Exception:
        logger.exception("repair_analytics_from_sources failed")
        raise


@shared_task
def cleanup_old_analytics():
    """
    Периодическая задача для очистки старых данных аналитики
    По умолчанию удаляет данные старше 90 дней
    """
    days = 90
    cutoff_date = timezone.now().date() - timedelta(days=days)

    deleted_daily = DailyAnalytics.objects.filter(date__lt=cutoff_date).delete()[0]
    deleted_events = CommentLikeAnalyticsEvent.objects.filter(
        day__lt=cutoff_date
    ).delete()[0]

    return (
        f"Удалено daily={deleted_daily}, comment_like_events={deleted_events} "
        f"старше {days} дней"
    )
