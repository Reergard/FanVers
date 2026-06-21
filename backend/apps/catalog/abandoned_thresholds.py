"""
Пороги неактивності для переведення перекладів у «Покинуті».

У проді: значення — дні (30 = 30 днів, 25 = 25 днів).
У dev: встановіть ABANDONED_THRESHOLDS_USE_MINUTES=1 — ті самі числа трактуються як хвилини. Текст попередження лічить «скільки залишилось» як TOTAL − WARNING_AFTER.
"""
import os
from datetime import timedelta

# У проді: дні. У dev (хвилини): ті самі імена та числа, але одиниця — хвилини.
# Dev-тест (хв): попередження після 25 хв неактивності, перенос після 30 хв; вікно (now−30, now−25] = 5 хв.
ABANDONED_TOTAL_DAYS = 30
ABANDONED_WARNING_AFTER_DAYS = 25


def thresholds_use_minutes():
    try:
        from django.conf import settings
        return bool(getattr(settings, 'ABANDONED_THRESHOLDS_USE_MINUTES', False))
    except Exception:
        return os.environ.get('ABANDONED_THRESHOLDS_USE_MINUTES', '').strip().lower() in (
            '1',
            'true',
            'yes',
        )


def total_inactivity_delta():
    """Повна неактивність до переносу в ABANDONED: 30 днів (або 30 хв у dev)."""
    if thresholds_use_minutes():
        return timedelta(minutes=ABANDONED_TOTAL_DAYS)
    return timedelta(days=ABANDONED_TOTAL_DAYS)


def warning_inactivity_delta():
    """Межа для попередження: після стільки днів/хв неактивності (у проді — 25 днів)."""
    if thresholds_use_minutes():
        return timedelta(minutes=ABANDONED_WARNING_AFTER_DAYS)
    return timedelta(days=ABANDONED_WARNING_AFTER_DAYS)
