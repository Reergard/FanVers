import re
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def _strip_html_tags(value: str) -> str:
    return re.sub(r"<[^>]*>", "", value or "")


class SupportTicket(models.Model):
    class Category(models.TextChoices):
        TECHNICAL = "technical", "Технічна проблема"
        PAYMENT = "payment", "Питання по платежам"
        CONTENT = "content", "Питання по контенту"
        ACCOUNT = "account", "Проблеми з акаунтом"
        SUGGESTIONS = "suggestions", "Пропозиції та побажання"
        OTHER = "other", "Інше"

    class Status(models.TextChoices):
        NEW = "new", "Новий"
        IN_PROGRESS = "in_progress", "В роботі"
        CLOSED = "closed", "Закритий"

    class Priority(models.TextChoices):
        LOW = "low", "Низький"
        NORMAL = "normal", "Звичайний"
        HIGH = "high", "Високий"
        URGENT = "urgent", "Терміновий"

    ticket_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        db_index=True,
        verbose_name="Номер звернення",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets",
        verbose_name="Користувач",
    )
    name = models.CharField(max_length=120, verbose_name="Ім'я / нік")
    email = models.EmailField(verbose_name="Email")
    subject = models.CharField(max_length=255, verbose_name="Тема")
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        db_index=True,
        verbose_name="Категорія",
    )
    message = models.TextField(verbose_name="Повідомлення")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
        verbose_name="Статус",
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        db_index=True,
        verbose_name="Пріоритет",
    )
    admin_comment = models.TextField(blank=True, verbose_name="Коментар адміністратора")
    source = models.CharField(
        max_length=64,
        default="support_page",
        db_index=True,
        verbose_name="Джерело",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP")
    user_agent = models.CharField(max_length=512, blank=True, verbose_name="User-Agent")
    http_referer = models.CharField(max_length=512, blank=True, verbose_name="Referer")
    submitted_page_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="Сторінка (клієнт)",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Створено")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Оновлено")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Звернення в підтримку"
        verbose_name_plural = "Звернення в підтримку"
        indexes = [
            models.Index(fields=["-created_at", "status"]),
            models.Index(fields=["email", "-created_at"]),
        ]

    def __str__(self):
        num = self.ticket_number or f"#{self.pk or '…'}"
        return f"{num} — {(self.subject or '')[:40]}"

    def clean(self):
        super().clean()
        if _strip_html_tags(self.message) != (self.message or ""):
            raise ValidationError({"message": "Текст не повинен містити HTML-тегів."})
        if _strip_html_tags(self.subject) != (self.subject or ""):
            raise ValidationError({"subject": "Тема не повинна містити HTML-тегів."})


class SupportTicketStatusHistory(models.Model):
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name="Звернення",
    )
    old_status = models.CharField(max_length=20, blank=True, verbose_name="Було")
    new_status = models.CharField(max_length=20, verbose_name="Стало")
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="Час зміни")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Хто змінив",
    )

    class Meta:
        ordering = ["-changed_at"]
        verbose_name = "Історія статусу"
        verbose_name_plural = "Історія статусів"

    def __str__(self):
        return f"{self.ticket_id}: {self.old_status!r} → {self.new_status!r}"


def support_attachment_upload_to(instance, filename):
    # filename уже безпечний (UUID + суфікс), згенерований у services.save_attachments
    return f"support_attachments/{timezone.now().strftime('%Y/%m')}/{filename}"


class SupportTicketAttachment(models.Model):
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="Звернення",
    )
    file = models.FileField(upload_to=support_attachment_upload_to, verbose_name="Файл")
    original_name = models.CharField(max_length=255, blank=True, verbose_name="Оригінальна назва")
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="Завантажено")

    class Meta:
        ordering = ["uploaded_at"]
        verbose_name = "Вкладення"
        verbose_name_plural = "Вкладення"

    def __str__(self):
        return self.original_name or str(self.file)
