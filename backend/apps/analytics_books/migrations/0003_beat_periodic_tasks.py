# Реєстрація періодичних задач у django_celery_beat (CELERY_BEAT_SCHEDULER = DatabaseScheduler).

from django.db import migrations


def forwards(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    def get_crontab(hour: int, minute: int):
        qs = CrontabSchedule.objects.filter(
            minute=str(minute),
            hour=str(hour),
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone="UTC",
        )
        s = qs.first()
        if s is None:
            s = CrontabSchedule.objects.create(
                minute=str(minute),
                hour=str(hour),
                day_of_week="*",
                day_of_month="*",
                month_of_year="*",
                timezone="UTC",
            )
        return s

    repair_sched = get_crontab(2, 30)
    PeriodicTask.objects.get_or_create(
        name="analytics-repair-from-sources",
        defaults={
            "task": "apps.analytics_books.tasks.repair_analytics_from_sources",
            "crontab": repair_sched,
            "enabled": True,
        },
    )
    # Очистка DailyAnalytics: у проєкті зазвичай уже є PeriodicTask `cleanup-old-analytics`
    # (celery.py + django-celery-beat). Дублікат не створюємо.


def backwards(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="analytics-repair-from-sources").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("analytics_books", "0002_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
