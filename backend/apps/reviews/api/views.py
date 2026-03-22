from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from apps.catalog.models import Book, Chapter
from apps.reviews.models import BookComment, ChapterComment
from .serializers import BookCommentSerializer, ChapterCommentSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
import logging
from rest_framework.exceptions import NotFound
from rest_framework.decorators import action
from apps.catalog.api.permissions import check_book_access_permission

logger = logging.getLogger(__name__)


class BookCommentViewSet(viewsets.ModelViewSet):
    serializer_class = BookCommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        book_slug = self.kwargs.get('slug')
        book = get_object_or_404(Book, slug=book_slug)
        if self.action == 'list':
            return BookComment.objects.filter(book=book, parent=None)  # Кореневі коментарі для списку
        return BookComment.objects.filter(book=book)  # Всі коментарі для retrieve/update/destroy

    def create(self, request, *args, **kwargs):
        logger.info(f"Received data: {request.data}")
        
        try:
            # Перевіряємо права доступу до коментування книги
            book_slug = self.kwargs.get('slug')
            book = get_object_or_404(Book, slug=book_slug)
            
            is_allowed, error_message = check_book_access_permission(
                request.user, book, 'comment_book'
            )
            
            if not is_allowed:
                return Response(
                    {"detail": error_message}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if not request.user.is_authenticated:
                return Response(
                    {"detail": "Для додавання коментарів потрібна авторизація."}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.error(f"Unexpected error in create comment: {str(e)}")
            return Response(
                {"detail": "Внутренняя ошибка сервера. Попробуйте позже."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        book_slug = self.kwargs.get('slug')
        book = get_object_or_404(Book, slug=book_slug)
        serializer.save(user=self.request.user, book=book)
        from apps.analytics_books.services.analytics_counters import record_comment_created

        record_comment_created(serializer.instance.book)

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            if not queryset.exists():
                return Response({'detail': 'Коментарів поки немає.'}, status=status.HTTP_200_OK)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Unexpected error in list comments: {str(e)}")
            return Response(
                {"detail": "Ошибка при загрузке комментариев. Попробуйте позже."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_success_headers(self, data):
        try:
            return {'Location': str(data['url'])}
        except (TypeError, KeyError):
            return {}

    def perform_destroy(self, instance):
        if self.request.user != instance.user:
            raise PermissionDenied("Можна видаляти лише свої коментарі.")
        from apps.analytics_books.services.analytics_counters import record_comment_deleted

        book = instance.book
        instance.delete()
        record_comment_deleted(book)


class ChapterCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ChapterCommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        chapter_slug = self.kwargs.get('slug')
        chapter = get_object_or_404(Chapter, slug=chapter_slug)
        if self.action == 'list':
            return ChapterComment.objects.filter(chapter=chapter, parent=None)  # Кореневі для списку
        return ChapterComment.objects.filter(chapter=chapter)  # Всі для retrieve/update/destroy

    def create(self, request, *args, **kwargs):
        logger.info(f"Received data: {request.data}")
        
        try:
            # Перевіряємо права доступу до коментування розділу
            chapter_slug = self.kwargs.get('slug')
            chapter = get_object_or_404(Chapter, slug=chapter_slug)
            book = chapter.book
            
            is_allowed, error_message = check_book_access_permission(
                request.user, book, 'comment_chapter'
            )
            
            if not is_allowed:
                return Response(
                    {"detail": error_message}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if not request.user.is_authenticated:
                return Response(
                    {"detail": "Для додавання коментарів потрібна авторизація."}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.error(f"Unexpected error in create chapter comment: {str(e)}")
            return Response(
                {"detail": "Внутренняя ошибка сервера. Попробуйте позже."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        chapter_slug = self.kwargs.get('slug')
        chapter = get_object_or_404(Chapter, slug=chapter_slug)
        serializer.save(user=self.request.user, chapter=chapter)
        from apps.analytics_books.services.analytics_counters import record_comment_created

        record_comment_created(chapter.book)

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            if not queryset.exists():
                return Response({'detail': 'Коментарів поки немає.'}, status=status.HTTP_200_OK)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Unexpected error in list chapter comments: {str(e)}")
            return Response(
                {"detail": "Ошибка при загрузке комментариев. Попробуйте позже."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_success_headers(self, data):
        try:
            return {'Location': str(data['url'])}
        except (TypeError, KeyError):
            return {}

    def perform_destroy(self, instance):
        if self.request.user != instance.user:
            raise PermissionDenied("Можна видаляти лише свої коментарі.")
        from apps.analytics_books.services.analytics_counters import record_comment_deleted

        book = instance.chapter.book
        instance.delete()
        record_comment_deleted(book)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None, slug=None):
        parent_comment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user, chapter=parent_comment.chapter, parent=parent_comment)
            from apps.analytics_books.services.analytics_counters import record_comment_created

            record_comment_created(parent_comment.chapter.book)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LikeDislikeViewSet(viewsets.ViewSet):
    @action(detail=True, methods=['post'])
    def update_reaction(self, request, pk=None):
        logger.info(f"Received data: {request.data}")
        logger.info(f"User: {request.user}")
        logger.info(f"Comment ID: {pk}")
        
        try:
            comment_type = self.basename  # 'book-comment' або 'chapter-comment'
            action = request.data.get('action')
            
            logger.info(f"Comment type: {comment_type}")
            logger.info(f"Action: {action}")

            if comment_type == 'book-comment':
                comment = get_object_or_404(BookComment, pk=pk)
            elif comment_type == 'chapter-comment':
                comment = get_object_or_404(ChapterComment, pk=pk)
            else:
                logger.error(f"Invalid comment type: {comment_type}")
                return Response({'error': 'Невірний тип коментаря'}, status=status.HTTP_400_BAD_REQUEST)

            user = request.user
            if not user.is_authenticated:
                logger.error("User is not authenticated")
                return Response({'error': 'Користувач не авторизований'}, 
                              status=status.HTTP_401_UNAUTHORIZED)

            from apps.analytics_books.services import analytics_counters as _ac

            book = comment.book if comment_type == "book-comment" else comment.chapter.book

            if action == 'like':
                liked = user in comment.likes.all()
                if liked:
                    comment.likes.remove(user)
                    _ac.record_comment_like_removed(book)
                else:
                    comment.likes.add(user)
                    comment.dislikes.remove(user)
                    _ac.record_comment_like_added(book)
            elif action == 'dislike':
                disliked = user in comment.dislikes.all()
                if disliked:
                    comment.dislikes.remove(user)
                else:
                    had_like = user in comment.likes.all()
                    if had_like:
                        comment.likes.remove(user)
                        _ac.record_comment_like_removed(book)
                    comment.dislikes.add(user)
            else:
                logger.error(f"Невірна дія: {action}")
                return Response({'error': 'Невірна дія'}, status=status.HTTP_400_BAD_REQUEST)

            if comment_type == 'book-comment':
                serializer = BookCommentSerializer(comment, context={'request': request})
            else:
                serializer = ChapterCommentSerializer(comment, context={'request': request})
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Unexpected error in update_reaction: {str(e)}")
            return Response(
                {'error': 'Внутренняя ошибка сервера. Попробуйте позже.'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def owner_like(self, request, pk=None):
        logger.info(f"Received owner like request for comment {pk}")
        comment_type = self.basename
        
        if comment_type == 'book-comment':
            comment = get_object_or_404(BookComment, pk=pk)
            serializer_class = BookCommentSerializer
        elif comment_type == 'chapter-comment':
            comment = get_object_or_404(ChapterComment, pk=pk)
            serializer_class = ChapterCommentSerializer
        else:
            return Response(
                {'error': 'Невірний тип коментаря'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        book = comment.book if hasattr(comment, 'book') else comment.chapter.book
        
        if request.user != book.owner:
            return Response(
                {'error': 'Тільки власник книги може ставити цей лайк'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # Перемикаємо стан owner_like
        if comment.owner_like == request.user:
            comment.owner_like = None
        else:
            comment.owner_like = request.user
        
        comment.save()
        
        serializer = serializer_class(comment, context={'request': request})
        return Response(serializer.data)
