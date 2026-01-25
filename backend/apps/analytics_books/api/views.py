from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import F, ExpressionWrapper, FloatField, DateTimeField
from django.db.models.functions import Cast, ExtractDay
from datetime import timedelta
from ..models import BookAnalytics, DailyAnalytics
from apps.catalog.models import Book
from apps.catalog.api.serializers import BookReaderSerializer

class TrendingBooksView(APIView):
    def get(self, request):
        type = request.query_params.get('type', 'day')
        limit = 15 if type == 'all_time' else 9
        
        if type == 'day':
            today = timezone.now().date()
            analytics = DailyAnalytics.objects.filter(date=today)
            books_with_scores = []
            for daily in analytics:
                score = (
                    daily.views +
                    daily.comments * 2 +
                    daily.book_ratings * 3 +
                    daily.translation_ratings * 3 +
                    daily.comment_likes +
                    daily.bookmarks * 4
                )
                books_with_scores.append({
                    'book': daily.book,
                    'score': score
                })
        elif type == 'week':
            week_ago = timezone.now().date() - timezone.timedelta(days=7)
            analytics = DailyAnalytics.objects.filter(date__gte=week_ago)
            books_scores = {}
            for daily in analytics:
                if daily.book not in books_scores:
                    books_scores[daily.book] = 0
                books_scores[daily.book] += (
                    daily.views +
                    daily.comments * 2 +
                    daily.book_ratings * 3 +
                    daily.translation_ratings * 3 +
                    daily.comment_likes +
                    daily.bookmarks * 4
                )
            books_with_scores = [
                {'book': book, 'score': score}
                for book, score in books_scores.items()
            ]
        elif type == 'month':
            month_ago = timezone.now().date() - timezone.timedelta(days=30)
            analytics = DailyAnalytics.objects.filter(date__gte=month_ago)
            books_scores = {}
            for daily in analytics:
                if daily.book not in books_scores:
                    books_scores[daily.book] = 0
                books_scores[daily.book] += (
                    daily.views +
                    daily.comments * 2 +
                    daily.book_ratings * 3 +
                    daily.translation_ratings * 3 +
                    daily.comment_likes +
                    daily.bookmarks * 4
                )
            books_with_scores = [
                {'book': book, 'score': score}
                for book, score in books_scores.items()
            ]
        else:
            # Для общего топа используем общую аналитику
            books = Book.objects.all()
            books_with_scores = []
            
            for book in books:
                try:
                    analytics = book.analytics
                    if analytics:
                        days = (timezone.now().date() - book.created_at.date()).days
                        days = max(1, days)  # Избегаем деления на 0
                        
                        total_score = (
                            analytics.views_count +
                            analytics.comments_count * 2 +
                            analytics.book_ratings_count * 3 +
                            analytics.translation_ratings_count * 3 +
                            analytics.comment_likes_count +
                            analytics.bookmarks_count * 4
                        )
                        
                        average_score = total_score / days
                        books_with_scores.append({
                            'book': book,
                            'score': average_score
                        })
                except Exception as e:
                    print(f"Ошибка при обработке книги {book.id}: {str(e)}")
                    continue
        
        # Сортируем по убыванию счета
        books_with_scores.sort(key=lambda x: x['score'], reverse=True)
        top_books = [item['book'] for item in books_with_scores[:limit]]
        
        # Сериализуем результаты
        serializer = BookReaderSerializer(
            top_books,
            many=True,
            context={'request': request}
        )
        
        return Response(serializer.data)


class UpdateAnalyticsView(APIView):
    def post(self, request):
        book_id_or_slug = request.data.get('book_id')
        action_type = request.data.get('action_type')
        
        print(f"Получен запрос на обновление аналитики: book_id_or_slug={book_id_or_slug}, action_type={action_type}")
        
        if not book_id_or_slug or not action_type:
            print("Ошибка: отсутствуют обязательные параметры")
            return Response(
                {'error': 'Missing required parameters'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Пробуем найти книгу по ID или slug
            if book_id_or_slug.isdigit():
                book = Book.objects.get(id=book_id_or_slug)
            else:
                book = Book.objects.get(slug=book_id_or_slug)
            print(f"Найдена книга: {book.title} (ID: {book.id}, slug: {book.slug})")
        except Book.DoesNotExist:
            print(f"Ошибка: книга не найдена (ID/slug: {book_id_or_slug})")
            return Response(
                {'error': 'Book not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Получаем или создаем объекты аналитики
        analytics, created = BookAnalytics.objects.get_or_create(book=book)
        daily_analytics, daily_created = DailyAnalytics.objects.get_or_create(
            book=book,
            date=timezone.now().date()
        )
        
        print(f"{'Создана новая' if created else 'Получена существующая'} запись BookAnalytics")
        print(f"{'Создана новая' if daily_created else 'Получена существующая'} запись DailyAnalytics")
        
        # Обновляем соответствующие счетчики
        if action_type == 'view':
            analytics.views_count += 1
            daily_analytics.views += 1
            print(f"Увеличен счетчик просмотров: {analytics.views_count}")
        elif action_type == 'comment':
            analytics.comments_count += 1
            daily_analytics.comments += 1
            print(f"Увеличен счетчик комментариев: {analytics.comments_count}")
        elif action_type == 'book_rating':
            analytics.book_ratings_count += 1
            daily_analytics.book_ratings += 1
            print(f"Увеличен счетчик оценок книги: {analytics.book_ratings_count}")
        elif action_type == 'translation_rating':
            analytics.translation_ratings_count += 1
            daily_analytics.translation_ratings += 1
            print(f"Увеличен счетчик оценок перевода: {analytics.translation_ratings_count}")
        elif action_type == 'comment_like':
            analytics.comment_likes_count += 1
            daily_analytics.comment_likes += 1
            print(f"Увеличен счетчик лайков комментариев: {analytics.comment_likes_count}")
        elif action_type == 'bookmark':
            analytics.bookmarks_count += 1
            daily_analytics.bookmarks += 1
            print(f"Увеличен счетчик закладок: {analytics.bookmarks_count}")
        else:
            print(f"Ошибка: неверный тип действия: {action_type}")
            return Response(
                {'error': 'Invalid action type'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        analytics.save()
        daily_analytics.save()
        print("Аналитика успешно обновлена и сохранена")
        
        return Response({'status': 'success'}) 