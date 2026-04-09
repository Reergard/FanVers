from rest_framework import permissions


class IsNotificationOwner(permissions.BasePermission):
    """Об'єкт сповіщення належить поточному користувачу."""

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
