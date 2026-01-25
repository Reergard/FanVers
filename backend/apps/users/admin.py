"""
Адміністративна панель для управління користувачами та їх профілями.

ВАЖЛИВО: Ролі користувачів (Читач, Перекладач, Літератор) управляються ТІЛЬКИ через розділ "Профілі".
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Profile, User
from .forms import CustomUserChangeForm, CustomUserCreationForm
from django.urls import reverse
import logging

logger = logging.getLogger(__name__)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Адміністративна панель для управління користувачами. Ролі управляються через Profile."""
    
    model = User
    ordering = ["username"]
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm

    list_display = ["email", "username", "created", "is_active", "get_profile_role"]
    list_display_links = ["email"]
    list_filter = ["is_active"]
    search_fields = ["email", "username"]

    def get_profile_role(self, obj):
        try:
            role = obj.profile.role
            if role == 'Літератор':
                return f"📚 {role}"
            elif role == 'Перекладач':
                return f"🔄 {role}"
            else:
                return f"👤 {role}"
        except:
            return '❓ Н/Д'
    get_profile_role.short_description = 'Роль користувача'

    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'user_permissions')}),
        ('Роль користувача', {
            'fields': (),
            'description': '⚠️ Ролі користувачів (Читач, Перекладач, Літератор) управляються через розділ "Профілі".',
            'classes': ('collapse',)
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'user_permissions')}),
    )


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """Адміністративна панель для управління профілями користувачів та їх ролями"""
    
    list_display = ('username', 'email', 'created', 'image', 'get_owned_books_count', 'role')
    search_fields = ('username', 'email')
    list_filter = ('role', 'created')
    
    def get_owned_books_count(self, obj):
        return obj.user.owned_books.count()
    get_owned_books_count.short_description = 'Кількість книг'

    def get_owned_books_list(self, obj):
        books = obj.user.owned_books.all()
        return '\n'.join([f"{book.title}" for book in books]) if books else "Немає"
    get_owned_books_list.short_description = 'Книги користувача'

    readonly_fields = ('get_owned_books_list', 'created')
    
    actions = ['make_reader', 'make_translator', 'make_author']

    def make_reader(self, request, queryset):
        try:
            updated = queryset.update(role='Читач')
            self.message_user(request, f'{updated} користувачів тепер мають роль "Читач".')
        except Exception as e:
            logger.error(f"Помилка при масовому зміненні ролей на 'Читач': {str(e)}")
            self.message_user(request, f'Помилка при зміненні ролей: {str(e)}', level='ERROR')
    make_reader.short_description = "Зробити читачами"

    def make_translator(self, request, queryset):
        try:
            updated = queryset.update(role='Перекладач')
            self.message_user(request, f'{updated} користувачів тепер мають роль "Перекладач".')
        except Exception as e:
            logger.error(f"Помилка при масовому зміненні ролей на 'Перекладач': {str(e)}")
            self.message_user(request, f'Помилка при зміненні ролей: {str(e)}', level='ERROR')
    make_translator.short_description = "Зробити перекладачами"

    def make_author(self, request, queryset):
        try:
            updated = queryset.update(role='Літератор')
            self.message_user(request, f'{updated} користувачів тепер мають роль "Літератор".')
        except Exception as e:
            logger.error(f"Помилка при масовому зміненні ролей на 'Літератор': {str(e)}")
            self.message_user(request, f'Помилка при зміненні ролей: {str(e)}', level='ERROR')
    make_author.short_description = "Зробити літераторами"
    
    fieldsets = (
        ('Основна інформація', {
            'fields': ('user', 'username', 'email', 'about', 'image', 'balance', 'commission'),
            'description': 'Основні дані профілю користувача'
        }),
        ('Роль користувача', {
            'fields': ('role',),
            'description': '🎯 Оберіть роль користувача. Доступні ролі: Читач, Перекладач, Літератор. Для масового змінення ролей використовуйте дії внизу сторінки.'
        }),
        ('Книги користувача', {
            'fields': ('get_owned_books_list',),
            'description': 'Список книг, які належать користувачеві',
            'classes': ('collapse',)
        }),
        ('Системна інформація', {
            'fields': ('created', 'token', 'is_default'),
            'description': 'Системні дані профілю',
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if 'role' in form.changed_data:  # Если роль была изменена
            new_role = form.cleaned_data['role']
            
            # Валідація ролі
            valid_roles = ['Читач', 'Перекладач', 'Літератор']
            if not new_role or new_role not in valid_roles:
                from django.contrib import messages
                messages.error(request, f"Невірна роль: '{new_role}'. Дозволені ролі: {', '.join(valid_roles)}. Ролі управляються через розділ 'Профілі'.")
                return
            
            try:
                logger.info(f"Роль користувача {obj.user.username} змінено на '{new_role}'")
                
                # Показуємо повідомлення про успіх
                from django.contrib import messages
                messages.success(request, f"Роль користувача {obj.user.username} успішно змінено на '{new_role}'.")
                
            except Exception as e:
                logger.error(f"Помилка зміни ролі для користувача {obj.user.username}: {str(e)}")
                from django.contrib import messages
                messages.error(request, f"Помилка зміни ролі: {str(e)}")
                return
            
        super().save_model(request, obj, form, change)

