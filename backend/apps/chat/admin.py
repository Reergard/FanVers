from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Chat, Message

@admin.register(Message)
class MessageAdmin(ModelAdmin):
    list_display = ('id', 'chat', 'sender', 'content', 'created_at')
    list_filter = ('chat', 'sender', 'created_at')
    search_fields = ('content', 'sender__username')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('chat', 'sender')


@admin.register(Chat)
class ChatAdmin(ModelAdmin):
    list_display = ('id', 'get_participants', 'created_at', 'updated_at', 'get_messages_count')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('participants__username',)
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('participants',)
    ordering = ('-updated_at',)

    def get_participants(self, obj):
        return ", ".join([user.username for user in obj.participants.all()])
    get_participants.short_description = 'Участники'

    def get_messages_count(self, obj):
        return obj.messages.count()
    get_messages_count.short_description = 'Количество сообщений'

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('participants', 'messages')

    fieldsets = (
        ('Основная информация', {
            'fields': ('participants',)
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
