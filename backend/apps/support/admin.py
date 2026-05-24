from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import SupportTicket, SupportTicketAttachment, SupportTicketStatusHistory


class SupportTicketAttachmentInline(TabularInline):
    model = SupportTicketAttachment
    extra = 0
    readonly_fields = ("uploaded_at",)
    fields = ("original_name", "file", "uploaded_at")


class SupportTicketStatusHistoryInline(TabularInline):
    model = SupportTicketStatusHistory
    extra = 0
    can_delete = False
    max_num = 0
    readonly_fields = ("old_status", "new_status", "changed_at", "changed_by")
    ordering = ("-changed_at",)


@admin.register(SupportTicket)
class SupportTicketAdmin(ModelAdmin):
    list_display = (
        "ticket_number",
        "created_at",
        "user_display",
        "email",
        "subject_short",
        "category",
        "status",
        "priority",
    )
    list_filter = ("status", "category", "priority", "created_at", "source")
    search_fields = ("email", "name", "subject", "message", "ticket_number")
    readonly_fields = (
        "ticket_number",
        "user",
        "name",
        "email",
        "category",
        "subject",
        "message",
        "ip_address",
        "user_agent",
        "http_referer",
        "submitted_page_url",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Звернення",
            {
                "fields": (
                    "ticket_number",
                    "status",
                    "priority",
                    "category",
                    "subject",
                    "message",
                    "admin_comment",
                )
            },
        ),
        (
            "Автор",
            {"fields": ("user", "name", "email")},
        ),
        (
            "Службові дані",
            {
                "fields": (
                    "source",
                    "ip_address",
                    "user_agent",
                    "http_referer",
                    "submitted_page_url",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
    inlines = (SupportTicketAttachmentInline, SupportTicketStatusHistoryInline)
    ordering = ("-created_at",)

    @admin.display(description="Користувач")
    def user_display(self, obj):
        if obj.user_id:
            return obj.user.username
        return "—"

    @admin.display(description="Тема")
    def subject_short(self, obj):
        s = obj.subject or ""
        return s[:60] + ("…" if len(s) > 60 else "")

    def save_model(self, request, obj, form, change):
        if change:
            obj._status_changed_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SupportTicketAttachment)
class SupportTicketAttachmentAdmin(ModelAdmin):
    list_display = ("ticket", "original_name", "uploaded_at")
    search_fields = ("original_name", "ticket__ticket_number")
    readonly_fields = ("uploaded_at",)
