from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab
import logging


os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FanVers_project.settings')
app = Celery('FanVers_project')
app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

# Покинуті переклади: у проді — раз на день (UTC 03:00). У dev: ABANDONED_BEAT_EVERY_MINUTE=True у .env — щохвилини.
# Розклад береться з django.conf.settings (env.bool), а не з сирого os.environ — інакше на Windows CRLF у .env
# ламає перевірку '1' і beat лишається на щоденному crontab → воркер не бачить задач хвилинами.
# Логіка попередження + переносу — у check_abandoned_books. Після зміни режиму видаліть celerybeat-schedule* у backend.
from django.conf import settings as django_settings

_abandoned_beat = (
    crontab(minute='*/1')
    if django_settings.ABANDONED_BEAT_EVERY_MINUTE
    else crontab(hour=3, minute=0)
)

app.conf.beat_schedule = {
    'check_abandoned_books': {
        'task': 'apps.notification.tasks.check_abandoned_books',
        'schedule': _abandoned_beat,
    },

    'cleanup-old-analytics': {
        'task': 'apps.analytics_books.tasks.cleanup_old_analytics',
        'schedule': crontab(hour=3, minute=0),
    },

    'repair-analytics-from-sources': {
        'task': 'apps.analytics_books.tasks.repair_analytics_from_sources',
        'schedule': crontab(hour=2, minute=30),
    },
}

# Пул воркера задається лише CLI: `celery worker -P solo` (Windows).
# Не додавати worker_pool у app.conf — інакше beat на Windows може одразу завершуватись.
