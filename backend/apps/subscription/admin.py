from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import (
    SubscriptionAdminAuditLog,
    BookSubscriptionSettings,
    BookSubscriptionPlan,
    UserBookSubscription,
    UserBookSubscriptionUsage,
    UserChapterAccess,
    SubscriptionOperation,
)


class BookSubscriptionPlanInline(TabularInline):
    model = BookSubscriptionPlan
    extra = 0
    readonly_fields = ['discount_percent', 'discount_threshold', 'purchase_mode', 'chapters_count', 'price', 'is_active', 'sort_order']


@admin.register(BookSubscriptionSettings)
class BookSubscriptionSettingsAdmin(ModelAdmin):
    list_display = ['book', 'is_enabled', 'updated_at']
    list_filter = ['is_enabled']
    inlines = [BookSubscriptionPlanInline]


@admin.register(BookSubscriptionPlan)
class BookSubscriptionPlanAdmin(ModelAdmin):
    list_display = ['settings', 'discount_percent', 'discount_threshold', 'purchase_mode', 'is_active', 'sort_order']
    list_filter = ['is_active', 'purchase_mode']
    readonly_fields = ['settings', 'discount_percent', 'discount_threshold', 'purchase_mode', 'chapters_count', 'price', 'is_active', 'sort_order']


@admin.register(UserBookSubscription)
class UserBookSubscriptionAdmin(ModelAdmin):
    list_display = ['user', 'book', 'plan', 'remaining_chapters_count', 'status', 'purchase_mode', 'created_at']
    list_filter = ['status', 'purchase_mode']


@admin.register(UserBookSubscriptionUsage)
class UserBookSubscriptionUsageAdmin(ModelAdmin):
    list_display = ['subscription', 'chapter', 'usage_type', 'source', 'chapters_consumed', 'restored_at', 'created_at']


@admin.register(SubscriptionOperation)
class SubscriptionOperationAdmin(ModelAdmin):
    list_display = ['user', 'operation_type', 'idempotency_key', 'status', 'created_at']


@admin.register(UserChapterAccess)
class UserChapterAccessAdmin(ModelAdmin):
    list_display = ['user', 'chapter', 'book', 'source', 'subscription', 'granted_at']
    list_filter = ['source']


@admin.register(SubscriptionAdminAuditLog)
class SubscriptionAdminAuditLogAdmin(ModelAdmin):
    list_display = ['subscription', 'operation', 'admin_user', 'request_id', 'created_at']
    list_filter = ['operation']
    readonly_fields = ['subscription', 'operation', 'admin_user', 'request_id', 'payload', 'result', 'created_at']
