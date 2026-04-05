from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.catalog.models import Chapter
from apps.navigation.models import Bookmark
from apps.reviews.models import BookComment, ChapterComment
from apps.editors.models import ErrorReport
from .models import Notification

@receiver(post_save, sender=Chapter)
def notify_bookmarked_users(sender, instance, created, **kwargs):
    if created: # Тільки для нових розділів
        book = instance.book
        # Отримуємо всіх користувачів, у яких є закладка на цю книгу
        bookmarks = Bookmark.objects.filter(book=book)
        
        for bookmark in bookmarks:
            notification_message = f'Повідомляємо, що в книзі "{book.title}" вийшов новий розділ {instance.title}'
            Notification.objects.create(
                user=bookmark.user,
                book=book,
                message=notification_message
            )

@receiver(post_save, sender=BookComment)
def notify_book_owner_on_book_comment(sender, instance, created, **kwargs):
    if created:
        book = instance.book
        owner = book.owner
        if owner:
            notification_message = f'Зверніть увагу, у вашій книзі {book.title} з\'явився коментар'
            Notification.objects.create(
                user=owner,
                book=book,
                message=notification_message
            )

@receiver(post_save, sender=ChapterComment)
def notify_book_owner_on_chapter_comment(sender, instance, created, **kwargs):
    if created:
        chapter = instance.chapter
        book = chapter.book
        owner = book.owner
        if owner:
            notification_message = f'Зверніть увагу, у розділі {chapter.title} книги {book.title} з\'явився коментар'
            Notification.objects.create(
                user=owner,
                book=book,
                message=notification_message
            )

@receiver(post_save, sender=ErrorReport)
def notify_book_owner_on_error_report(sender, instance, created, **kwargs):
    if created:
        book = instance.book
        owner = book.owner
        if owner:
            notification_message = (
                f'Увага, користувач {instance.user.username} пропонує виправлення у книзі "{book.title}".'
            )
            Notification.objects.create(
                user=owner,
                book=book,
                message=notification_message,
                error_report=instance
            )