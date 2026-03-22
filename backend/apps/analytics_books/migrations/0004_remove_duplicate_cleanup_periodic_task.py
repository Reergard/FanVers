# Прибрати дубль cleanup, якщо 0003 встигла створити `analytics-cleanup-old-daily-analytics`.
# Якщо в БД ще немає `cleanup-old-analytics` (greenfield + DatabaseScheduler) — створити.

from django.db import migrations


def forwards(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="analytics-cleanup-old-daily-analytics").delete()

    if PeriodicTask.objects.filter(name="cleanup-old-analytics").exists():
        return

    qs = CrontabSchedule.objects.filter(
        minute="0",
        hour="3",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone="UTC",
    )
    sched = qs.first()
    if sched is None:
        sched = CrontabSchedule.objects.create(
            minute="0",
            hour="3",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone="UTC",
        )
    PeriodicTask.objects.create(
        name="cleanup-old-analytics",
        task="apps.analytics_books.tasks.cleanup_old_analytics",
        crontab=sched,
        enabled=True,
    )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("analytics_books", "0003_beat_periodic_tasks"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
