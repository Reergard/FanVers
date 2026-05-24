from django.contrib import admin
from unfold.admin import ModelAdmin
from django.utils.html import format_html
from .models import TransactionLog, BalanceOperationLog, UserChapterProgress, AdvertisingLog
from django.db.models import Sum
from django.utils import timezone

@admin.register(TransactionLog)
class TransactionLogAdmin(ModelAdmin):
    list_display = (
        'book_info',
        'buyer_info',
        'owner_info',
        'created_at',
        'chapter_info',
        'original_price',
        'final_amount',
        'commission_percent',
        'commission_amount',
        'get_daily_commission',
        'get_monthly_commission',
        'get_yearly_commission',
        'get_total_commission'
    )
    list_filter = ('created_at', 'commission_percent', 'book__title')
    search_fields = (
        'buyer__user__username',
        'owner__user__username',
        'chapter__title',
        'book__title'
    )
    readonly_fields = (
        'created_at',
        'buyer',
        'owner',
        'chapter',
        'book',
        'original_price',
        'commission_percent',
        'commission_amount',
        'final_amount'
    )
    ordering = ('-created_at',)

    def buyer_info(self, obj):
        return format_html(
            '<strong>Покупець:</strong> {} ({})',
            obj.buyer.user.username,
            obj.buyer.role
        )
    buyer_info.short_description = 'Покупець'

    def owner_info(self, obj):
        return format_html(
            '<strong>Власник:</strong> {} ({})',
            obj.owner.user.username,
            obj.owner.role
        )
    owner_info.short_description = 'Власник'

    def chapter_info(self, obj):
        return format_html(
            '<strong>{}:</strong> {} символів',
            obj.chapter.title,
            obj.chapter.characters_count
        )
    chapter_info.short_description = 'Глава'

    def book_info(self, obj):
        return format_html(
            '<strong>{}</strong>',
            obj.book.title
        )
    book_info.short_description = 'Книга'

    def get_daily_commission(self, obj):
        today = timezone.now().date()
        total = TransactionLog.objects.filter(
            created_at__date=today
        ).aggregate(
            total=Sum('commission_amount')
        )['total'] or 0
        return f"За день: {total:.2f}"
    get_daily_commission.short_description = 'Комісія за день'

    def get_monthly_commission(self, obj):
        today = timezone.now()
        total = TransactionLog.objects.filter(
            created_at__year=today.year,
            created_at__month=today.month
        ).aggregate(
            total=Sum('commission_amount')
        )['total'] or 0
        return f"За місяць: {total:.2f}"
    get_monthly_commission.short_description = 'Комісія за місяць'

    def get_yearly_commission(self, obj):
        today = timezone.now()
        total = TransactionLog.objects.filter(
            created_at__year=today.year
        ).aggregate(
            total=Sum('commission_amount')
        )['total'] or 0
        return f"За рік: {total:.2f}"
    get_yearly_commission.short_description = 'Комісія за рік'

    def get_total_commission(self, obj):
        total = TransactionLog.objects.aggregate(
            total=Sum('commission_amount')
        )['total'] or 0
        return f"Всього: {total:.2f}"
    get_total_commission.short_description = 'Загальна комісія'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }

@admin.register(BalanceOperationLog)
class BalanceOperationLogAdmin(ModelAdmin):
    list_display = (
        'get_username',
        'created_at',
        'operation_type',
        'amount',
        'status'
    )
    list_filter = ('operation_type', 'status', 'created_at')
    search_fields = ('profile__user__username',)
    readonly_fields = ('profile', 'amount', 'operation_type', 'status', 'created_at')
    ordering = ('-created_at',)

    def get_username(self, obj):
        return obj.profile.user.username
    get_username.short_description = 'Користувач'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

@admin.register(UserChapterProgress)
class UserChapterProgressAdmin(ModelAdmin):
    list_display = ['user', 'chapter', 'is_read', 'is_purchased', 
                   'reading_progress', 'last_read_at']
    list_filter = ['is_read', 'is_purchased', 'last_read_at']
    search_fields = ['user__username', 'chapter__title']
    raw_id_fields = ['user', 'chapter']

@admin.register(AdvertisingLog)
class AdvertisingLogAdmin(ModelAdmin):
    list_display = (
        'user',
        'book',
        'location',
        'target_kind',
        'target_id',
        'start_date',
        'end_date',
        'total_cost',
        'created_at'
    )
    list_filter = ('location', 'target_kind', 'created_at', 'start_date', 'end_date')
    search_fields = ('user__username', 'book__title')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
