from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action, api_view, permission_classes
from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from apps.catalog.models import Book, Chapter
from apps.catalog.api.serializers import ChapterSerializer
from .serializers import BookmarkSerializer
from ..models import Bookmark, ChapterPagination
import logging
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)


class ChapterNavigationView(APIView):
    def get(self, request, book_slug, chapter_slug):
        try:
            # Отримуємо книгу та поточний розділ
            book = get_object_or_404(Book, slug=book_slug)
            current_chapter = get_object_or_404(Chapter, book=book, slug=chapter_slug)
            
            # Отримуємо всі розділи книги, відсортовані за позицією
            all_chapters = list(book.chapters.all().order_by('_position'))
            
            if not all_chapters:
                return Response({
                    'current_chapter': None,
                    'prev_chapter': None,
                    'next_chapter': None,
                    'all_chapters': []
                })
            
            # Знаходимо індекс поточного розділу
            try:
                current_index = all_chapters.index(current_chapter)
            except ValueError:
                return Response(
                    {'error': 'Розділ не знайдено у списку розділів книги'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Визначаємо попередній та наступний розділ
            prev_chapter = all_chapters[current_index - 1] if current_index > 0 else None
            next_chapter = all_chapters[current_index + 1] if current_index < len(all_chapters) - 1 else None

            def get_chapter_data(chapter):
                if not chapter:
                    return None
                    
                is_purchased = False
                if request.user.is_authenticated:
                    is_purchased = request.user.profile.purchased_chapters.filter(id=chapter.id).exists()
                
                return {
                    'title': chapter.title,
                    'slug': chapter.slug,
                    'is_paid': chapter.is_paid,
                    'is_purchased': is_purchased,
                    'id': chapter.id,
                    'volume': chapter.volume.id if chapter.volume else None
                }

            return Response({
                'current_chapter': get_chapter_data(current_chapter),
                'prev_chapter': get_chapter_data(prev_chapter),
                'next_chapter': get_chapter_data(next_chapter),
                'all_chapters': [get_chapter_data(ch) for ch in all_chapters]
            })
            
        except Book.DoesNotExist:
            return Response(
                {'error': 'Книгу не знайдено'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Розділ не знайдено'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Помилка при отриманні навігації: {str(e)}")
            return Response(
                {'error': 'Внутрішня помилка сервера'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user).select_related('book')

    def list(self, request, *args, **kwargs):
        """Отримання всіх закладок користувача з можливістю фільтрації"""
        queryset = self.get_queryset()
        
        # Фільтрація за статусом якщо передано
        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        
        # Сортування за датою оновлення (найновіші спочатку)
        queryset = queryset.order_by('-updated_at')
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Перевіряємо, чи існує вже закладка
        existing_bookmark = Bookmark.objects.filter(
            user=self.request.user,
            book_id=serializer.validated_data['book_id']
        ).first()

        if existing_bookmark:
            # Якщо закладка існує, оновлюємо її статус
            existing_bookmark.status = serializer.validated_data['status']
            existing_bookmark.save()
            serializer.instance = existing_bookmark
        else:
            # Якщо закладки немає, створюємо нову
            serializer.save(user=self.request.user)
        
        # Інвалідуємо кеш статистики читання
        cache_key = f'user_reading_stats_{self.request.user.id}'
        cache.delete(cache_key)

    @action(detail=False, methods=['get'], url_path='status/(?P<status>.+)')
    def filter_by_status(self, request, status=None):
        queryset = self.get_queryset().filter(status=status)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bookmark_status(request, book_id):
    """
    Отримання статусу закладки для конкретної книги
    """
    print(f"Отримання статусу закладки для книги {book_id} та користувача {request.user}") 
    
    try:
        bookmark = Bookmark.objects.get(book_id=book_id, user=request.user)
        print(f"Знайдено закладку: {bookmark}")  
        return Response({
            'id': bookmark.id,
            'status': bookmark.status
        })
    except Bookmark.DoesNotExist:
        print(f"Закладку не знайдено") 
        return Response({
            'id': None,
            'status': None
        })


class ChapterViewSet(viewsets.ModelViewSet):
    serializer_class = ChapterSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Chapter.objects.all()

    @action(detail=False, methods=['get'])
    def paginated_chapters(self, request):
        book_id = request.query_params.get('book_id')
        start_chapter = int(request.query_params.get('start_chapter', 1))

        if not book_id:
            return Response(
                {'error': 'book_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            book = Book.objects.get(id=book_id)
            total_chapters = Chapter.objects.filter(book_id=book_id).count()
            chapters_per_page = ChapterPagination.get_chapters_per_page(total_chapters)
            
            end_chapter = min(start_chapter + chapters_per_page - 1, total_chapters)
            
            # Получаем только главы в указанном диапазоне
            chapters = Chapter.objects.filter(
                book_id=book_id
            ).order_by('_position')[start_chapter-1:end_chapter]
            
            serializer = self.get_serializer(chapters, many=True)
            
            return Response({
                'chapters': serializer.data,
                'total_chapters': total_chapters,
                'current_range': {
                    'start': start_chapter,
                    'end': end_chapter
                },
                'page_ranges': ChapterPagination.get_page_ranges(total_chapters)
            })
            
        except Book.DoesNotExist:
            return Response(
                {'error': 'Book not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in paginated_chapters: {str(e)}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
