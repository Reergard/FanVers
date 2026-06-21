from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import reverse, path
from django.utils import timezone
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from .models import (
    Book, Tag, Fandom, Country, Genres, TagGroups, Chapter, Volume,
    TranslatorApplication, BookTranslatorReview,
)

import logging

logger = logging.getLogger(__name__)


@admin.register(Book)
class BookAdmin(ModelAdmin):

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
class ChapterAdmin(ModelAdmin):
    list_display = ['title']
    search_fields = ['title']


@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ['name', 'get_tags']
    search_fields = [all]

    def get_tags(self, obj):
        return obj.group.name


@admin.register(TagGroups)
class TagGroupsAdmin(ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Fandom)
class FandomAdmin(ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Country)
class CountryAdmin(ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Genres)
class GenresAdmin(ModelAdmin):
    list_display = ['name']
    search_fields = ['name']


@admin.register(Volume)
class VolumeAdmin(ModelAdmin):
    list_display = ['title', 'book', 'created_at']
    list_filter = ['book']
    search_fields = ['title', 'book__title']
    ordering = ['created_at']


class TranslatorApplicationInline(TabularInline):
    """Інлайн заявок на переклад всередині BookTranslatorReview."""
    model = TranslatorApplication
    extra = 0
    can_delete = False
    max_num = 0  # Забороняємо додавання нових заявок через інлайн
    readonly_fields = [
        'user',
        'status',
        'created_at',
        'reviewed_at',
        'get_user_stats',
        'get_actions',
    ]
    fields = ['user', 'status', 'created_at', 'get_user_stats', 'get_actions']

    def has_add_permission(self, request, obj=None):
        return False

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .filter(status=TranslatorApplication.Status.PENDING)
            .select_related('user', 'user__profile', 'book')
        )

    def get_user_stats(self, obj):
        """Статистика користувача: книги, розділи, статуси."""
        if not obj or not obj.pk:
            return '—'
        user = obj.user
        owned_books = Book.objects.filter(owner=user)
        total_books = owned_books.count()
        translating = owned_books.filter(translation_status='TRANSLATING').count()
        waiting = owned_books.filter(translation_status='WAITING').count()
        completed = owned_books.filter(translation_status='COMPLETED').count()
        abandoned = owned_books.filter(translation_status='ABANDONED').count()

        created_books = Book.objects.filter(creator=user)
        total_chapters = Chapter.objects.filter(book__in=created_books).count()

        profile = getattr(user, 'profile', None)
        total_chars = profile.total_characters if profile else 0
        role = profile.get_role_display() if profile else '—'

        return format_html(
            '<span style="white-space: pre-line">'
            'Роль: {}\n'
            'Книг у власності: {} '
            '(перекладає: {}, очікує розділів: {}, '
            'покинуто: {}, завершено: {})\n'
            'Усього розділів створено: {}\n'
            'Усього символів перекладено: {}'
            '</span>',
            role, total_books,
            translating, waiting,
            abandoned, completed,
            total_chapters, f'{total_chars:,}',
        )
    get_user_stats.short_description = 'Статистика'

    def get_actions(self, obj):
        """Кнопки «Схвалити» / «Відмовити» для кожної заявки."""
        if not obj or not obj.pk:
            return '—'
        if obj.status != TranslatorApplication.Status.PENDING:
            return obj.get_status_display()

        approve_url = reverse(
            'admin:catalog_booktranslatorreview_approve',
            args=[obj.pk],
        )
        reject_url = reverse(
            'admin:catalog_booktranslatorreview_reject',
            args=[obj.pk],
        )
        return format_html(
            '<a href="{}" class="font-medium inline-flex items-center gap-1 px-3 py-1.5 '
            'rounded-default bg-primary-600 text-white text-xs whitespace-nowrap">'
            'Схвалити</a> '
            '<a href="{}" class="font-medium inline-flex items-center gap-1 px-3 py-1.5 '
            'rounded-default bg-red-600 text-white text-xs whitespace-nowrap">'
            'Відмовити</a>',
            approve_url,
            reject_url,
        )
    get_actions.short_description = 'Дії'


@admin.register(BookTranslatorReview)
class BookTranslatorReviewAdmin(ModelAdmin):
    inlines = [TranslatorApplicationInline]

    list_display = [
        'title',
        'get_applicants_count',
        'get_translation_status_display',
        'get_owner_display',
    ]
    list_filter = ['translation_status']
    search_fields = ['title', 'title_en']
    readonly_fields = [
        'title',
        'title_en',
        'author',
        'translation_status',
        'get_owner_display',
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_queryset(self, request):
        """Показуємо лише книги, що мають хоча б одну PENDING заявку."""
        qs = super().get_queryset(request)
        return qs.filter(
            translator_applications__status=TranslatorApplication.Status.PENDING,
        ).distinct()

    def get_applicants_count(self, obj):
        count = TranslatorApplication.objects.filter(
            book=obj, status=TranslatorApplication.Status.PENDING,
        ).count()
        return f'{count} заявок' if count != 1 else '1 заявка'
    get_applicants_count.short_description = 'Очікуваних заявок'

    def get_translation_status_display(self, obj):
        return obj.get_translation_status_display() or '—'
    get_translation_status_display.short_description = 'Статус перекладу'

    def get_owner_display(self, obj):
        return obj.owner.username if obj.owner else '—'
    get_owner_display.short_description = 'Поточний власник'

    def get_fieldsets(self, request, obj=None):
        return (
            ('Інформація про книгу', {
                'fields': (
                    'title',
                    'author',
                    'translation_status',
                    'get_owner_display',
                ),
            }),
        )

    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        extra_context = extra_context or {}
        # Ховаємо стандартні кнопки збереження — тут тільки заявки
        extra_context['show_save'] = False
        extra_context['show_save_and_continue'] = False
        extra_context['show_save_and_add_another'] = False
        extra_context['show_save_as_new'] = False
        return super().changeform_view(
            request, object_id, form_url, extra_context,
        )

    def get_urls(self):
        custom_urls = [
            path(
                'approve-application/<int:app_id>/',
                self.admin_site.admin_view(self.approve_view),
                name='catalog_booktranslatorreview_approve',
            ),
            path(
                'reject-application/<int:app_id>/',
                self.admin_site.admin_view(self.reject_view),
                name='catalog_booktranslatorreview_reject',
            ),
        ]
        return custom_urls + super().get_urls()

    # ── Action views ─────────────────────────────────────────────

    def approve_view(self, request, app_id):
        application = self._get_application_or_404(app_id)
        level, message = self._approve_application_instance(application)
        self.message_user(request, message, level=level)
        return HttpResponseRedirect(
            reverse(
                'admin:catalog_booktranslatorreview_change',
                args=[application.book_id],
            )
        )

    def reject_view(self, request, app_id):
        application = self._get_application_or_404(app_id)
        level, message = self._reject_application_instance(application)
        self.message_user(request, message, level=level)
        return HttpResponseRedirect(
            reverse(
                'admin:catalog_booktranslatorreview_change',
                args=[application.book_id],
            )
        )

    def _get_application_or_404(self, app_id):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(TranslatorApplication, pk=app_id)

    # ── Бізнес-логіка схвалення / відмови ────────────────────────

    def _approve_application_instance(self, application):
        from datetime import timedelta
        from apps.notification.models import Notification
        from apps.catalog.abandoned_thresholds import total_inactivity_delta
        from apps.users.models import User

        if application.status != TranslatorApplication.Status.PENDING:
            return messages.WARNING, 'Ця заявка вже розглянута.'

        book = application.book
        user = application.user

        if book.translation_status != 'ABANDONED':
            return (
                messages.ERROR,
                f'Книга «{book.title}» більше не в статусі «Покинутий».',
            )

        book.owner = user
        book.translation_status = 'TRANSLATING'

        grace_days = 5
        book.owner_last_activity_at = (
            timezone.now() - total_inactivity_delta() + timedelta(days=grace_days)
        )
        book.abandoned_warning_sent_at = None

        book.save(update_fields=[
            'owner',
            'translation_status',
            'owner_last_activity_at',
            'abandoned_warning_sent_at',
        ])

        application.status = TranslatorApplication.Status.APPROVED
        application.reviewed_at = timezone.now()
        application.save(update_fields=['status', 'reviewed_at'])

        other_pending = TranslatorApplication.objects.filter(
            book=book, status=TranslatorApplication.Status.PENDING
        ).exclude(pk=application.pk)

        rejected_users = list(other_pending.values_list('user', flat=True))
        other_pending.update(
            status=TranslatorApplication.Status.REJECTED,
            reviewed_at=timezone.now(),
        )

        # Нотифікація схваленому користувачу
        Notification.objects.create(
            user=user,
            book=book,
            message=(
                f'Вам передано переклад «{book.title}». '
                f'Зверніть увагу: оскільки книга перебувала у покинутих перекладах, '
                f'у вас є 5 днів для публікації нових розділів. '
                f'У разі бездіяльності книгу буде повернено до покинутих.'
            ),
        )

        # Нотифікації відхиленим користувачам
        for rejected_user_id in rejected_users:
            try:
                rejected_user = User.objects.get(pk=rejected_user_id)
                Notification.objects.create(
                    user=rejected_user,
                    book=book,
                    message=(
                        f'Приносимо вибачення, але «{book.title}» не може бути '
                        f'передана вам, оскільки адміністрація сайту передала '
                        f'переклад іншому користувачу.'
                    ),
                )
            except User.DoesNotExist:
                pass

        return (
            messages.SUCCESS,
            f'Книгу «{book.title}» передано користувачу {user.username}. '
            f'Відхилено інших заявок: {len(rejected_users)}.',
        )

    def _reject_application_instance(self, application):
        from apps.notification.models import Notification

        if application.status != TranslatorApplication.Status.PENDING:
            return messages.WARNING, 'Ця заявка вже розглянута.'

        book = application.book
        user = application.user

        application.status = TranslatorApplication.Status.REJECTED
        application.reviewed_at = timezone.now()
        application.save(update_fields=['status', 'reviewed_at'])

        Notification.objects.create(
            user=user,
            book=book,
            message=(
                f'На жаль, вашу заявку на переклад «{book.title}» відхилено. '
                f'Книга наразі залишається у покинутих перекладах.'
            ),
        )

        return (
            messages.SUCCESS,
            f'Заявку користувача {user.username} на «{book.title}» відхилено.',
        )

