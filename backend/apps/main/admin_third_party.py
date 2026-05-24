"""
Перереєстрація admin-класів сторонніх пакетів з unfold (лише оформлення, логіка без змін).
Імпортується з MainConfig.ready() після завантаження всіх admin.py.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin

# django-celery-beat
from django_celery_beat.admin import (
    ClockedScheduleAdmin,
    CrontabScheduleAdmin,
    IntervalScheduleAdmin,
    PeriodicTaskAdmin,
    SolarScheduleAdmin,
)
from django_celery_beat.models import (
    ClockedSchedule,
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
    SolarSchedule,
)

# DRF authtoken
from rest_framework.authtoken.admin import TokenAdmin
from rest_framework.authtoken.models import TokenProxy

# python-social-auth
from social_django.admin import AssociationOption, NonceOption, UserSocialAuthOption
from social_django.models import Association, Nonce, UserSocialAuth


def _reregister(model, base_admin):
    if model not in admin.site._registry:
        return
    admin.site.unregister(model)

    class AdminClass(base_admin, ModelAdmin):
        pass

    AdminClass.__name__ = f"{base_admin.__name__}Unfold"
    admin.site.register(model, AdminClass)


def register_third_party_unfold_admins():
    _reregister(PeriodicTask, PeriodicTaskAdmin)
    _reregister(ClockedSchedule, ClockedScheduleAdmin)
    _reregister(CrontabSchedule, CrontabScheduleAdmin)
    _reregister(SolarSchedule, SolarScheduleAdmin)
    _reregister(IntervalSchedule, IntervalScheduleAdmin)

    _reregister(TokenProxy, TokenAdmin)

    _reregister(UserSocialAuth, UserSocialAuthOption)
    _reregister(Nonce, NonceOption)
    _reregister(Association, AssociationOption)
