from django.contrib import admin

from .models import PaymentSession, WebhookEvent


@admin.register(PaymentSession)
class PaymentSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "amount_coins", "status", "created_at", "paid_at")
    list_filter = ("status", "currency")
    search_fields = ("user__username", "user__email", "stripe_session_id")
    readonly_fields = ("stripe_session_id", "stripe_payment_intent_id", "paid_at", "created_at")


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("stripe_event_id", "event_type", "processed_at")
    list_filter = ("event_type",)
    readonly_fields = ("payload", "processed_at")

