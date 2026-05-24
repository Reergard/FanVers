from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Advertisement

@admin.register(Advertisement)
class AdvertisementAdmin(ModelAdmin):
    list_display = (
        'get_book_title',
        'get_user_username',
        'location',
        'start_date',
        'end_date',
        'total_cost',
        'is_active',
        'created_at'
    )
    list_filter = (
        'location',
        'is_active',
        'start_date',
        'end_date',
        'created_at'
    )
    search_fields = (
        'book__title',
        'user__username',
        'location'
    )
    readonly_fields = ('created_at', 'total_cost')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_per_page = 20

    def get_book_title(self, obj):
        return obj.book.title
    get_book_title.short_description = 'Книга'
    get_book_title.admin_order_field = 'book__title'

    def get_user_username(self, obj):
        return obj.user.username
    get_user_username.short_description = 'Користувач'
    get_user_username.admin_order_field = 'user__username'

    fieldsets = (
        ('Основна інформація', {
            'fields': ('book', 'user', 'location')
        }),
        ('Період та вартість', {
            'fields': ('start_date', 'end_date', 'total_cost')
        }),
        ('Статус', {
            'fields': ('is_active', 'created_at')
        }),
    )

    def has_add_permission(self, request):
        return False  # Заборона створення через адмін-панель
