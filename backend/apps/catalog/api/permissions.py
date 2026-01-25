from rest_framework import permissions
from apps.catalog.models import Book
from apps.users.models import User
from apps.navigation.models import Bookmark
from django.shortcuts import get_object_or_404

class IsBookOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user

class IsNotBookOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner != request.user


def check_book_access_permission(user, book, permission_type):
    """
    Перевіряє права доступу користувача до книги
    
    Args:
        user: Користувач, який намагається виконати дію
        book: Книга, до якої намагається отримати доступ
        permission_type: Тип дозволу ('view', 'comment_book', 'comment_chapter', 'download', 'rate')
    
    Returns:
        tuple: (is_allowed, error_message)
    """
    if not user or not user.is_authenticated:
        return False, "Необхідна авторизація"
    
    # Власник завжди має доступ
    if book.owner == user:
        return True, None
    
    # Отримуємо налаштування доступу
    permission_field = f"{permission_type}_permission"
    permission_value = getattr(book, permission_field, 'all')
    
    if permission_value == 'none':
        return False, "Доступ заборонено власником книги"
    
    if permission_value == 'bookmarked':
        # Перевіряємо, чи є книга в закладках користувача
        has_bookmark = Bookmark.objects.filter(
            user=user, 
            book=book
        ).exists()
        
        if not has_bookmark:
            return False, "Доступ тільки для користувачів, у яких книга в закладках"
    
    # permission_value == 'all'
    return True, None
