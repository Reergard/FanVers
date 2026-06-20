from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from .models import Book, Tag, Fandom, Country, Genres, TagGroups, Chapter, Volume, TranslatorApplication

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


@admin.register(TranslatorApplication)
class TranslatorApplicationAdmin(ModelAdmin):
    change_form_after_template = 'admin/catalog/translatorapplication/review_actions.html'

    list_display = [
        'get_book_title',
        'get_applicants_count',
        'get_book_status',
        'created_at',
        'status',
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['book__title', 'user__username']
    readonly_fields = [
        'book',
        'user',
        'get_status_label',
        'created_at',
        'reviewed_at',
        'get_other_applicants',
        'get_user_stats',
    ]
    actions = ['approve_application']

    def has_add_permission(self, request):
        return False

    def get_status_label(self, obj):
        if not obj:
            return '—'
        return obj.get_status_display()
    get_status_label.short_description = 'Статус заявки'

    def get_other_applicants(self, obj):
        if not obj or not obj.pk:
            return '—'
        others = (
            TranslatorApplication.objects.filter(
                book=obj.book,
                status=TranslatorApplication.Status.PENDING,
            )
            .exclude(pk=obj.pk)
            .select_related('user')
            .order_by('created_at')
        )
        if not others:
            return 'Інших очікуваних заявок на цю книгу немає'
        lines = []
        for application in others:
            url = reverse(
                'admin:catalog_translatorapplication_change',
                args=[application.pk],
            )
            lines.append(format_html(
                '<a href="{}">{}</a> — заявка від {}, {}',
                url,
                application.user.username,
                application.created_at.strftime('%d.%m.%Y %H:%M'),
                application.get_status_display(),
            ))
        return format_html('<br>'.join(lines))
    get_other_applicants.short_description = 'Інші претенденти на цю книгу'

    def get_book_title(self, obj):
        return obj.book.title
    get_book_title.short_description = 'Книга'
    get_book_title.admin_order_field = 'book__title'

    def get_applicants_count(self, obj):
        count = TranslatorApplication.objects.filter(
            book=obj.book, status='PENDING'
        ).count()
        return f'{count} заявок' if count != 1 else '1 заявка'
    get_applicants_count.short_description = 'Претенденти'

    def get_book_status(self, obj):
        return obj.book.get_translation_status_display() or '—'
    get_book_status.short_description = 'Статус книги'

    def get_user_stats(self, obj):
        """Статистика користувача: книги, розділи, статуси."""
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

        return (
            f'Роль: {role}\n'
            f'Книг у власності: {total_books} '
            f'(перекладає: {translating}, очікує розділів: {waiting}, '
            f'покинуто: {abandoned}, завершено: {completed})\n'
            f'Усього розділів створено: {total_chapters}\n'
            f'Усього символів перекладено: {total_chars:,}'
        )
    get_user_stats.short_description = 'Статистика користувача'

    def get_fieldsets(self, request, obj=None):
        return (
            ('Заявка', {
                'fields': (
                    'book',
                    'user',
                    'get_status_label',
                    'created_at',
                    'reviewed_at',
                    'get_other_applicants',
                ),
            }),
            ('Статистика претендента', {
                'fields': ('get_user_stats',),
                'classes': ('collapse',),
            }),
        )

    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        extra_context = extra_context or {}
        obj = self.get_object(request, object_id) if object_id else None
        pending = (
            obj is not None
            and obj.status == TranslatorApplication.Status.PENDING
        )
        extra_context['show_review_actions'] = pending

        response = super().changeform_view(
            request, object_id, form_url, extra_context
        )

        if hasattr(response, 'context_data') and response.context_data and pending:
            response.context_data['show_save'] = False
            response.context_data['show_save_and_continue'] = False
            response.context_data['show_save_and_add_another'] = False
            response.context_data['show_save_as_new'] = False

        return response

    def response_change(self, request, obj):
        if '_approve_application' in request.POST:
            level, message = self._approve_application_instance(obj)
            self.message_user(request, message, level=level)
            return HttpResponseRedirect(
                reverse('admin:catalog_translatorapplication_change', args=[obj.pk])
            )

        if '_reject_application' in request.POST:
            level, message = self._reject_application_instance(obj)
            self.message_user(request, message, level=level)
            return HttpResponseRedirect(
                reverse('admin:catalog_translatorapplication_change', args=[obj.pk])
            )

        return super().response_change(request, obj)

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

        for rejected_user_id in rejected_users:
            try:
                rejected_user = User.objects.get(pk=rejected_user_id)
                Notification.objects.create(
                    user=rejected_user,
                    book=book,
                    message=(
                        f'На жаль, вашу заявку на переклад «{book.title}» відхилено. '
                        f'Книгу передано іншому перекладачу.'
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

    @admin.action(description='✅ Схвалити заявку та передати книгу')
    def approve_application(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                'Оберіть рівно одну заявку для схвалення.',
                level=messages.ERROR,
            )
            return

        level, message = self._approve_application_instance(queryset.first())
        self.message_user(request, message, level=level)

