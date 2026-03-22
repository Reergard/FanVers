"""
Пороги неактивності для переведення перекладів у «Покинуті».

У проді: значення — дні (90 = 90 днів, 83 = 83 дні).
У dev: встановіть ABANDONED_THRESHOLDS_USE_MINUTES=1 — ті самі числа трактуються як хвилини. Текст попередження лічить «скільки залишилось» як TOTAL − WARNING_AFTER.
"""
import os
from datetime import timedelta

# У проді: дні. У dev (хвилини): ті самі імена та числа, але одиниця — хвилини.
# Dev-тест (хв): попередження після 10 хв неактивності, перенос після 15 хв; вікно (now−15, now−10] = 5 хв.
ABANDONED_TOTAL_DAYS = 15
ABANDONED_WARNING_AFTER_DAYS = 10


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
    """Повна неактивність до переносу в ABANDONED: 90 днів (або 90 хв у dev)."""
    if thresholds_use_minutes():
        return timedelta(minutes=ABANDONED_TOTAL_DAYS)
    return timedelta(days=ABANDONED_TOTAL_DAYS)


def warning_inactivity_delta():
    """Межа для попередження: після стільки днів/хв неактивності (у проді — 83 дні)."""
    if thresholds_use_minutes():
        return timedelta(minutes=ABANDONED_WARNING_AFTER_DAYS)
    return timedelta(days=ABANDONED_WARNING_AFTER_DAYS)
