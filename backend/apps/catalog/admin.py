from django.contrib import admin
from .models import Book, Tag, Fandom, Country, Genres, TagGroups, Chapter, Volume

import logging

logger = logging.getLogger(__name__)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):

    list_display = ['title', 'title_en', 'author', 'get_creator', 'get_owner', 'translation_status', 'original_status', 'get_tags', 'get_fandoms', 'get_country', 'get_genres', 'last_updated']
    list_filter = ['author', 'creator', 'owner', 'tags', 'fandoms', 'country', 'genres', 'translation_status', 'original_status', 'last_updated']
    search_fields = ['title', 'author', 'creator__username', 'owner__username']
    
    def save_model(self, request, obj, form, change):
        """Переопределяем сохранение для правильной обработки"""
        try:
            logger.info(f"Сохранение книги в админке: change={change}, title={obj.title}, author={obj.author}, country={obj.country_id}")
            
            # Если создается новая книга и не указан creator/owner, устанавливаем текущего пользователя
            if not change:  # Новая книга
                if not obj.creator:
                    obj.creator = request.user
                    logger.info(f"Установлен creator: {request.user.username}")
                if not obj.owner:
                    obj.owner = request.user
                    logger.info(f"Установлен owner: {request.user.username}")
            
            # Сохраняем объект (clean() вызывается автоматически через форму)
            super().save_model(request, obj, form, change)
            logger.info(f"Книга успешно сохранена: ID={obj.id}, slug={obj.slug}")
        except Exception as e:
            logger.error(f"Ошибка сохранения книги в админке: {str(e)}", exc_info=True)
            raise
    
    def save_formset(self, request, form, formset, change):
        """Обработка формсетов (для inline форм)"""
        super().save_formset(request, form, formset, change)

    def get_fieldsets(self, request, obj=None):
        """Условное отображение полей в зависимости от типа книги"""
        if obj and obj.book_type == 'AUTHOR':
            # Для авторских книг скрываем поле translation_status
            fieldsets = (
                ('Основна інформація', {
                    'fields': ('title', 'title_en', 'author', 'book_type', 'description', 'image')
                }),
                ('Класифікація', {
                    'fields': ('tags', 'genres', 'fandoms', 'country', 'adult_content')
                }),
                ('Статус оригіналу', {
                    'fields': ('original_status',)
                }),
                ('Системна інформація', {
                    'fields': ('creator', 'owner', 'slug'),
                    'classes': ('collapse',)
                }),
            )
        else:
            # Для переводов показываем все поля
            fieldsets = (
                ('Основна інформація', {
                    'fields': ('title', 'title_en', 'author', 'book_type', 'description', 'image')
                }),
                ('Класифікація', {
                    'fields': ('tags', 'genres', 'fandoms', 'country', 'adult_content')
                }),
                ('Статус перекладу', {
                    'fields': ('translation_status',)
                }),
                ('Статус оригіналу', {
                    'fields': ('original_status',)
                }),
                ('Системна інформація', {
                    'fields': ('creator', 'owner', 'slug'),
                    'classes': ('collapse',)
                }),
            )
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        """Поля только для чтения"""
        readonly_fields = ['slug', 'created_at', 'last_updated']
        # translation_status не добавляем в readonly_fields, так как для авторских книг поле скрыто
        return readonly_fields

    def get_creator(self, obj):
        return obj.creator.username if obj.creator else 'Не вказано'
    get_creator.short_description = 'Творець'

    def get_owner(self, obj):
        return obj.owner.username if obj.owner else 'Не вказано'
    get_owner.short_description = 'Власник'

    def get_tags(self, obj):
        return ", ".join([tag.name for tag in obj.tags.all()])

    def get_genres(self, obj):
        return ", ".join([genres.name for genres in obj.genres.all()])

    def get_fandoms(self, obj):
        return ", ".join([fandom.name for fandom in obj.fandoms.all()])

    def get_country(self, obj):
        return obj.country.name if obj.country else 'Не вказано'
    get_country.short_description = 'Країна'

    def get_chapter(self, obj):
        return ",".join([chapter.title for chapter in obj.chapters.all()])

    def get_last_updated(self, obj):
        return obj.last_updated.strftime("%d.%m.%Y %H:%M")
    get_last_updated.short_description = 'Останнє оновлення'
    get_last_updated.admin_order_field = 'last_updated'


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['title']
    search_fields = ['title']


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'get_tags']
    search_fields = [all]

    def get_tags(self, obj):
        return obj.group.name


@admin.register(TagGroups)
class TagGroupsAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Fandom)
class FandomAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Genres)
class GenresAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Volume)
class VolumeAdmin(admin.ModelAdmin):
    list_display = ['title', 'book', 'created_at']
    list_filter = ['book']
    search_fields = ['title', 'book__title']
    ordering = ['created_at']

