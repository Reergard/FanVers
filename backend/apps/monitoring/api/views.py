from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.catalog.models import Chapter, Book
from ..models import UserChapterProgress, AuthorThanks
from .serializers import UserChapterProgressSerializer, UserReadingStatsSerializer, CreateAuthorThanksSerializer
from django.utils import timezone
from django.contrib.auth.models import User
from django.db import models
from apps.navigation.models import Bookmark
from apps.users.api.mixins import BalanceOperationMixin
import logging

logger = logging.getLogger(__name__)

class ChapterProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, chapter_id):
        chapter = get_object_or_404(Chapter, id=chapter_id)
        progress = UserChapterProgress.objects.filter(
            user=request.user,
            chapter=chapter
        ).first()
        
        serializer = UserChapterProgressSerializer(progress)
        return Response(serializer.data)

    def post(self, request, chapter_id):
        chapter = get_object_or_404(Chapter, id=chapter_id)
        reading_time = float(request.data.get('reading_time', 0))
        scroll_progress = float(request.data.get('scroll_progress', 0))

        progress, created = UserChapterProgress.objects.get_or_create(
            user=request.user,
            chapter=chapter
        )

        # Завжди оновлюємо час читання та позицію прокрутки
        progress.reading_time = reading_time
        progress.scroll_position = scroll_progress
        progress.last_read_at = timezone.now()

        # Перевіряємо умови для зарахування прочитання
        min_reading_time = chapter.min_reading_time
        is_time_valid = reading_time >= min_reading_time
        is_scroll_valid = scroll_progress >= 90

        if not progress.is_read and is_scroll_valid and is_time_valid:
            progress.is_read = True
            progress.reading_speed = chapter.character_count / reading_time

            # Перевіряємо, чи всі глави книги прочитані
            book = chapter.book
            total_chapters = book.chapters.count()
            read_chapters = UserChapterProgress.objects.filter(
                user=request.user,
                chapter__book=book,
                is_read=True
            ).count()

            progress.save()
            response_data = UserChapterProgressSerializer(progress).data
            response_data['book_completed'] = (total_chapters == read_chapters)
            return Response(response_data)

        progress.save()
        return Response(UserChapterProgressSerializer(progress).data)

class UserReadingStatsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'monitoring'

    def get(self, request):
        user = request.user
        profile = user.profile

        # Підрахунок придбаних глав (UserChapterAccess — джерело правди)
        from apps.subscription.models import UserChapterAccess
        purchased_chapters = UserChapterAccess.objects.filter(user=user).count()
        
        # Підрахунок прочитаних глав
        read_chapters = UserChapterProgress.objects.filter(
            user=user,
            is_read=True
        ).count()
        
        # Підрахунок книг зі статусом "completed"
        completed_books = Bookmark.objects.filter(
            user=user,
            status='completed'
        ).count()

        stats = {
            'purchased_chapters': purchased_chapters,
            'read_chapters': read_chapters,
            'completed_books': completed_books
        }

        return Response(stats)


class AuthorThanksView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'thanks'

    def post(self, request):
        """Создание благодарности автору"""
        try:
            # Валидация входных данных
            serializer = CreateAuthorThanksSerializer(data=request.data)
            
            if not serializer.is_valid():
                error_messages = []
                for field, errors in serializer.errors.items():
                    if isinstance(errors, list):
                        error_messages.extend(errors)
                    else:
                        error_messages.append(str(errors))
                
                return Response(
                    {'error': '; '.join(error_messages)}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            book_id = serializer.validated_data['book_id']
            amount = serializer.validated_data['amount']
            message = serializer.validated_data.get('message', '')
            
            # Получаем книгу с дополнительными проверками
            try:
                book = Book.objects.select_related('owner').get(id=book_id)
            except Book.DoesNotExist:
                return Response(
                    {'error': 'Книга не знайдена'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Проверяем, что пользователь не пытается поблагодарить сам себя
            if book.owner == request.user:
                return Response(
                    {'error': 'Ви не можете подякувати самому собі'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Получаем профили с проверками
            try:
                giver_profile = request.user.profile
                receiver_profile = book.owner.profile
            except Exception as e:
                logger.error(f"Error getting profiles: {str(e)}")
                return Response(
                    {'error': 'Помилка отримання профілів користувачів'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Проверяем максимальную сумму (валидация уже прошла в сериализаторе, но для безопасности)
            if amount > 10000:
                return Response(
                    {'error': 'Максимальна сума подяки: 10,000 FanCoins'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Throttling уже ограничивает частоту запросов (5/min), поэтому дополнительная проверка не нужна
            
            balance_mixin = BalanceOperationMixin()
            
            with transaction.atomic():
                # Списываем с дарителя
                giver_result = balance_mixin.perform_balance_operation(
                    giver_profile,
                    amount,
                    'thanks_given'
                )
                
                # Начисляем получателю
                receiver_result = balance_mixin.perform_balance_operation(
                    receiver_profile,
                    amount,
                    'thanks_received'
                )
                
                # Создаем запись о благодарности
                thanks = AuthorThanks.objects.create(
                    giver=request.user,
                    receiver=book.owner,
                    book=book,
                    amount=amount,
                    message=message
                )
                
                # Логируем операцию
                logger.info(f"User {request.user.username} thanked {book.owner.username} for book {book.title} with {amount} FanCoins")
            
            return Response({
                'message': 'Подяку успішно відправлено',
                'new_balance': float(giver_result),
                'thanks_id': thanks.id,
                'amount': float(amount)
            })
            
        except ValidationError as e:
            logger.warning(f"Validation error in author thanks: {str(e)}")
            # Передаем конкретное сообщение об ошибке пользователю
            error_message = str(e)
            if "Недостатньо коштів" in error_message:
                error_message = "Вибачте, але на вашому балансі недостатньо коштів для цієї операції"
            elif "Максимальний баланс" in error_message:
                error_message = "Максимальний баланс отримувача перевищено"
            elif "Невірна сума операції" in error_message:
                error_message = "Невірна сума операції"
            elif "Сума повинна бути більше нуля" in error_message:
                error_message = "Сума повинна бути більше нуля"
            
            return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error creating author thanks: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Внутрішня помилка сервера. Спробуйте пізніше'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )