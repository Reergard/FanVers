from django.apps import AppConfig


class SupportConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.support"
    verbose_name = "Підтримка"

    def ready(self):
        from . import signals  # noqa: F401
