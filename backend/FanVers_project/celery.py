from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab
import logging


os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FanVers_project.settings')
app = Celery('FanVers_project')
app.config_from_object('django.conf:settings', namespace='CELERY')


app.conf.broker_url = 'redis://localhost:6379/0'
app.conf.result_backend = 'redis://localhost:6379/0'

app.autodiscover_tasks()

app.conf.beat_schedule = {
    'send_abandoned_notification': {
        'task': 'apps.notification.tasks.send_abandoned_notification',
        'schedule': crontab(minute='*/1'),
    },

    'check_abandoned_books': {
        'task': 'apps.notification.tasks.check_abandoned_books',
        'schedule': crontab(minute='*/1'),
    },

    'cleanup-old-analytics': {
        'task': 'apps.analytics_books.tasks.cleanup_old_analytics',
        'schedule': crontab(hour=3, minute=0),
    },
}

app.conf.update(
    worker_pool_restarts=True,
    worker_pool='solo',
)
