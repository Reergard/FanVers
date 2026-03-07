from rest_framework.response import Response
from apps.catalog.models import Book, Chapter, Genres, Tag, Country, Fandom, Volume, ChapterOrder, ChapterOrderContainer
from apps.catalog.api.serializers import (
    ChapterSerializer, GenresSerializer, TagSerializer,
    CountrySerializer, FandomSerializer, VolumeSerializer, ChapterOrderSerializer,
    BookOwnerSerializer, BookReaderSerializer, BookCreateSerializer
)
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR
from rest_framework import status
import os
import mammoth
import logging
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAuthenticated
from apps.navigation.models import Bookmark
from django.db import transaction
from django.db.models import Max
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from django.conf import settings
from django.utils.translation import gettext as _
from django.utils import timezone
from apps.catalog.utils.errorUtils import get_error_codes
from apps.catalog.api.permissions import (
    IsBookOwner,
    IsNotBookOwner,
    check_book_access_permission,
    is_book_owner_or_creator,
)
from rest_framework import generics
from rest_framework import serializers
from django.utils.text import slugify
import uuid
# Удаляем импорт старых throttling классов
from apps.core.smart_throttling import SmartThrottle

logger = logging.getLogger(__name__)


@api_view(['GET'])
def genres_list(request):
    genres = Genres.objects.all()
    serializer = GenresSerializer(genres, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
def tags_list(request):
    tags = Tag.objects.all()
    serializer = TagSerializer(tags, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
def countries_list(request):
    countries = Country.objects.all()
    serializer = CountrySerializer(countries, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
def fandoms_list(request):
    fandoms = Fandom.objects.all()
    serializer = FandomSerializer(fandoms, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET', 'POST'])
def Catalog(request):
    permission_classes = [AllowAny]
    if request.method == 'GET':
        books = Book.objects.all()
        serializer = BookReaderSerializer(books, many=True, context={'request': request})
        return Response(serializer.data)

    if request.method == 'POST':
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Необхідна авторизація'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = BookOwnerSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@api_view(['GET'])
def chapter_list(request, book_slug):
    try:
        book = Book.objects.get(slug=book_slug)
        chapters = Chapter.objects.filter(book=book).select_related('volume').order_by(
            'volume__order', 'order'
        )
        serializer = ChapterSerializer(
            chapters,
            many=True,
            context={'request': request}
        )
        containers = ChapterOrderContainer.objects.filter(
            book=book
        ).values('volume_id', 'version')
        container_versions = {str(c['volume_id']) if c['volume_id'] else 'null': c['version'] for c in containers}
        return Response({
            'chapters': serializer.data,
            'container_versions': container_versions,
        }, status=status.HTTP_200_OK)
        
    except Book.DoesNotExist:
        return Response(
            {'error': 'Книга не знайдена'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception:
        return Response(
            {'error': 'Помилка при отриманні списку глав'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def chapter_detail(request, book_slug, chapter_slug):
    try:
        chapter = Chapter.objects.select_related('book').get(
            book__slug=book_slug, 
            slug=chapter_slug
        )

        # Власник/творець книги завжди має доступ до будь-якої глави, включно з платною.
        is_owner_or_creator = is_book_owner_or_creator(request.user, chapter.book)
        logger.warning(
            "CHAPTER_DETAIL_ACCESS user_id=%s owner_id=%s creator_id=%s book_slug=%s chapter_slug=%s is_owner_or_creator=%s is_paid=%s",
            request.user.id if request.user.is_authenticated else None,
            chapter.book.owner_id,
            chapter.book.creator_id,
            book_slug,
            chapter_slug,
            is_owner_or_creator,
            chapter.is_paid,
        )
        if not is_owner_or_creator:
            # Для платної глави неавторизований користувач має отримати 401.
            if chapter.is_paid and not request.user.is_authenticated:
                return Response(
                    {"error": "Необхідна авторизація для перегляду платної глави"},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Загальні правила доступу до книги для інших користувачів.
            is_allowed, error_message = check_book_access_permission(
                request.user, chapter.book, 'download'
            )
            if not is_allowed:
                return Response(
                    {"error": error_message}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # Платну главу може читати тільки той, хто купив.
            if chapter.is_paid:
                try:
                    is_purchased = request.user.profile.purchased_chapters.filter(id=chapter.id).exists()
                except ObjectDoesNotExist:
                    is_purchased = False
                if not is_purchased:
                    return Response(
                        {"error": "Необхідно придбати главу для перегляду"}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
        
        html_content = chapter.get_html_content()
        
        if html_content is None:
            if not chapter.file or not os.path.exists(chapter.file.path):
                return Response(
                    {"error": "Файл розділу не знайдено"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
                
            try:
                with open(chapter.file.path, "rb") as docx_file:
                    result = mammoth.convert_to_html(docx_file)
                    html_content = result.value
                    chapter.save_html_content(html_content)
            except Exception:
                return Response(
                    {"error": "Помилка при конвертації файлу розділу"}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        if not html_content:
            return Response(
                {"error": "Контент розділ недступний"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Отладочная информация
        book_owner_id = chapter.book.owner.id if chapter.book.owner else None
        print(f"ChapterDetail API: book_id={chapter.book.id}, owner={chapter.book.owner}, book_owner_id={book_owner_id}")
        
        return Response({
            'title': chapter.title,
            'content': html_content,
            'book_title': chapter.book.title,
            'book': chapter.book.id,
            'id': chapter.id,
            'book_id': chapter.book.id,
            'book_owner_id': book_owner_id,
            'is_paid': chapter.is_paid,
            'price': float(chapter.price) if chapter.price else None,
            'slug': chapter.slug
        })
        
    except Chapter.DoesNotExist:
        return Response(
            {"error": "Главу не знайдено"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception:
        return Response(
            {"error": "Виникла помилка при обробці розділу"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated, IsBookOwner])
def add_chapter(request, slug):
    try:
        book = get_object_or_404(Book, slug=slug)
        
        if request.user != book.owner:
            return Response(
                {'error': 'У вас немає прав для додавання глав до цієї книги'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        volume_id = request.data.get('volume')
        is_paid = request.data.get('is_paid', '').lower() == 'true'
        title = request.data.get('title')
        
        # Для бесплатных глав устанавливаем цену 0, для платных - берем из запроса
        if is_paid:
            try:
                price = Decimal(request.data.get('price', '1.00'))
            except (TypeError, ValueError):
                price = Decimal('1.00')
            
            if price <= 0 or price > 1000:
                return Response(
                    {'error': 'Некоректна ціна розділу'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Для бесплатных глав всегда устанавливаем цену 0
            price = Decimal('0.00')
            
        if 'file' not in request.FILES:
            return Response(
                {'error': 'Файл розділу обов\'язковий'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        vol_id = int(volume_id) if volume_id else None
        with transaction.atomic():
            Book.objects.select_for_update().get(id=book.id)
            agg = Chapter.objects.filter(book=book, volume_id=vol_id).aggregate(Max('order'))
            next_order = (agg['order__max'] or 0) + 1
            chapter = Chapter.objects.create(
                book=book,
                title=title,
                file=request.FILES['file'],
                volume_id=vol_id,
                is_paid=is_paid,
                price=price,
                order=next_order,
            )
        
        # Обновляем last_updated книги при создании главы
        book.last_updated = timezone.now()
        book.save(update_fields=['last_updated'])
        
        # Генерируем HTML контент сразу при создании главы
        try:
            with open(chapter.file.path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html_content = result.value
                chapter.save_html_content(html_content)
        except Exception as e:
            logger.error(f"Ошибка при генерации HTML контента для главы {chapter.id}: {str(e)}")
            # Не прерываем создание главы, просто логируем ошибку
        
        serializer = ChapterSerializer(chapter)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )

def get_chapter_content(request, chapter_id):
    chapter = get_object_or_404(Chapter, id=chapter_id)
    with open(chapter.file.path, "rb") as docx_file:
        result = mammoth.convert_to_html(docx_file)
        html_content = result.value
    return JsonResponse({'content': html_content})


class BookOwnerViewSet(viewsets.ModelViewSet):
    serializer_class = BookOwnerSerializer
    lookup_field = 'slug'
    permission_classes = [IsAuthenticated, IsBookOwner]

    def get_queryset(self):
        return Book.objects.filter(owner=self.request.user)


class BookReaderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BookReaderSerializer
    lookup_field = 'slug'
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Book.objects.all().order_by('-last_updated')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Перевіряємо права доступу до перегляду книги
        is_allowed, error_message = check_book_access_permission(
            request.user, instance, 'view'
        )
        
        if not is_allowed:
            return Response(
                {"detail": error_message}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.user.is_authenticated:
            bookmark = Bookmark.objects.filter(
                book=instance,
                user=request.user
            ).first()
            
            if bookmark:
                instance.bookmark_status = bookmark.status
                instance.bookmark_id = bookmark.id
            else:
                instance.bookmark_status = None
                instance.bookmark_id = None
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)





@api_view(['GET', 'POST'])
def volume_list(request, book_slug):
    book = get_object_or_404(Book, slug=book_slug)
    
    if request.method == 'GET':
        volumes = Volume.objects.filter(book=book)
        serializer = VolumeSerializer(volumes, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = VolumeSerializer(data={**request.data, 'book': book.id})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_volume(request, book_slug):
    try:
        book = Book.objects.get(slug=book_slug)
        
        # Перевіряємо, чи є користувач власником книги
        if request.user != book.owner:
            return Response(
                {'error': 'У вас немає прав для створення томів у цій книзі'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        if 'title' not in request.data:
            return Response(
                {'error': 'Назва тому обов\'язкова'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        with transaction.atomic():
            max_order = Volume.objects.filter(book=book).aggregate(Max('order'))['order__max'] or 0
            volume = Volume.objects.create(
                book=book,
                title=request.data['title'],
                order=max_order + 1,
            )
        
        serializer = VolumeSerializer(volume)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Book.DoesNotExist:
        return Response(
            {'error': 'Книгу не знайдено'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_book(request):
    try:
        print(f"create_book: Получен запрос от пользователя {request.user.username}")
        
        # Обработка FormData: DRF может не всегда правильно обрабатывать QueryDict для ManyToMany
        # Поэтому явно обрабатываем массивы из FormData
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        
        # Если это QueryDict (FormData), обрабатываем ManyToMany поля явно
        if hasattr(request.data, 'getlist'):
            # Создаем обычный dict для сериализатора, но сохраняем множественные значения
            processed_data = {}
            for key in request.data.keys():
                if key in ['genres', 'tags', 'fandoms']:
                    # Для ManyToMany полей используем getlist
                    values = request.data.getlist(key)
                    # Конвертируем строки в int, если возможно
                    try:
                        processed_data[key] = [int(v) if isinstance(v, str) and v.isdigit() else v for v in values]
                    except (ValueError, TypeError):
                        processed_data[key] = values
                else:
                    # Для остальных полей берем первое значение (или значение как есть)
                    value = request.data.get(key)
                    processed_data[key] = value
            data = processed_data
            print(f"create_book: Обработанные данные FormData: genres={data.get('genres')}, tags={data.get('tags')}, fandoms={data.get('fandoms')}")
        
        serializer = BookCreateSerializer(data=data)
        
        if serializer.is_valid():
            print("create_book: Данные валидны, создаем книгу")
            book = serializer.save(
                owner=request.user,
                creator=request.user
            )
            
            print(f"create_book: Книга успешно создана с ID: {book.id}, slug: {book.slug}")
            print(f"create_book: Жанры: {list(book.genres.values_list('id', flat=True))}")
            print(f"create_book: Теги: {list(book.tags.values_list('id', flat=True))}")
            print(f"create_book: Фандомы: {list(book.fandoms.values_list('id', flat=True))}")
            
            # Используем BookOwnerSerializer для полного ответа
            response_serializer = BookOwnerSerializer(book, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        else:
            print(f"create_book: Ошибки валидации: {serializer.errors}")
            
            # Формируем детальное сообщение об ошибках
            error_details = {}
            for field, errors in serializer.errors.items():
                if isinstance(errors, list):
                    error_details[field] = errors[0] if errors else 'Помилка валідації'
                else:
                    error_details[field] = str(errors)
            
            print(f"create_book: Сформированные детали ошибок: {error_details}")
            
            return Response(
                {
                    'error': 'Помилка даних',
                    'details': error_details,
                    'message': 'Перевірте правильність заповнення всіх полів'
                }, 
                status=HTTP_400_BAD_REQUEST
            )
            
    except Exception as e:
        print(f"create_book: Критическая ошибка: {str(e)}")
        logger.error(f"create_book: Ошибка создания книги: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Внутрішня помилка сервера: {str(e)}'},
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def update_book(request, slug):
    try:
        book = get_object_or_404(Book, slug=slug)
        if book.owner != request.user:
            return Response(
                {'error': 'У вас немає прав для редагування цієї книги'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy() if hasattr(request.data, 'copy') else request.data

        if hasattr(request.data, 'getlist'):
            processed_data = {}
            for key in request.data.keys():
                if key in ['genres', 'tags', 'fandoms']:
                    values = request.data.getlist(key)
                    try:
                        processed_data[key] = [int(v) if isinstance(v, str) and v.isdigit() else v for v in values]
                    except (ValueError, TypeError):
                        processed_data[key] = values
                else:
                    processed_data[key] = request.data.get(key)
            data = processed_data

        serializer = BookCreateSerializer(instance=book, data=data, partial=True)

        if serializer.is_valid():
            serializer.save()
            response_serializer = BookOwnerSerializer(book, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            error_details = {}
            for field, errors in serializer.errors.items():
                if isinstance(errors, list):
                    error_details[field] = errors[0] if errors else 'Помилка валідації'
                else:
                    error_details[field] = str(errors)
            return Response(
                {
                    'error': 'Помилка даних',
                    'details': error_details,
                    'message': 'Перевірте правильність заповнення всіх полів'
                },
                status=HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"update_book: Ошибка обновления книги: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Внутрішня помилка сервера: {str(e)}'},
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def owned_books(request):
    try:
        books = Book.objects.filter(owner=request.user)
        serializer = BookOwnerSerializer(books, many=True, context={'request': request})
        return Response(serializer.data)
    except Exception:
        return Response(
            {"error": "Внутрішня помилка сервера"}, 
            status=500
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_translations(request):
    """
    API для отримання перекладів конкретного користувача
    Включає всі книги, де користувач є власником або творцем
    """
    try:
        # Отримуємо книги, де користувач є власником або творцем
        user_books = Book.objects.filter(
            owner=request.user
        ).select_related(
            'owner', 'creator', 'country'
        ).prefetch_related(
            'genres', 'tags', 'fandoms'
        ).order_by('-last_updated')
        
        # Додаємо додаткову інформацію про кожну книгу
        from apps.monitoring.models import TransactionLog, BookView
        from django.utils import timezone
        from django.db.models import Sum
        
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        books_with_stats = []
        for book in user_books:
            book_data = BookOwnerSerializer(book, context={'request': request}).data
            
            # Доход за день
            daily_income = TransactionLog.objects.filter(
                owner=request.user.profile,
                book=book,
                created_at__date=today
            ).aggregate(
                total=Sum('final_amount')
            )['total'] or 0
            
            # Доход за месяц
            monthly_income = TransactionLog.objects.filter(
                owner=request.user.profile,
                book=book,
                created_at__date__gte=month_start
            ).aggregate(
                total=Sum('final_amount')
            )['total'] or 0
            
            # Реальные просмотры за день
            daily_views = BookView.get_daily_views(book, today)
            
            # Добавляем статистику та дату створення до даних книги
            from django.utils.dateformat import format
            book_data.update({
                'daily_income': float(daily_income),
                'monthly_income': float(monthly_income),
                'daily_views': daily_views,
                'created_at': format(book.created_at, 'd.m.Y') if book.created_at else None,
                'last_updated': format(book.last_updated, 'd.m.Y') if book.last_updated else None,
            })
            
            books_with_stats.append(book_data)
        
        return Response(books_with_stats, status=HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Помилка в user_translations: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )


def _normalize_container_order(book_id, volume_id):
    """Нормалізує order в контейнері до 1, 2, 3... Двофазно, щоб уникнути UniqueConstraint."""
    chapters = list(
        Chapter.objects.filter(book_id=book_id, volume_id=volume_id)
        .order_by('order', 'id')
    )
    OFFSET = 100000
    for i, ch in enumerate(chapters, start=1):
        if ch.order != i:
            ch.order = OFFSET + ch.id
            ch.save(update_fields=['order'])
    for i, ch in enumerate(chapters, start=1):
        ch.order = i
        ch.save(update_fields=['order'])


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_chapter(request, book_slug, chapter_id):
    try:
        chapter = get_object_or_404(Chapter, id=chapter_id, book__slug=book_slug)
        
        # Перевіряємо права доступу
        if request.user != chapter.book.owner:
            return Response(
                {'error': 'У вас немає прав для видалення цієї розділу'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Видаляємо файл розділу, якщо він існує
        if chapter.file:
            if os.path.exists(chapter.file.path):
                os.remove(chapter.file.path)
        
        # Видаляємо HTML-контент, якщо він існує
        if chapter.html_file_path:
            html_path = os.path.join(settings.MEDIA_ROOT, chapter.html_file_path)
            if os.path.exists(html_path):
                os.remove(html_path)
        
        book = chapter.book
        vol_id = chapter.volume_id
        chapter.delete()
        _normalize_container_order(book.id, vol_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
        
    except Chapter.DoesNotExist:
        return Response(
            {'error': 'Главу не знайдено'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Помилка видалення розділу: {str(e)}")
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class BookInfoView(generics.RetrieveAPIView):
    queryset = Book.objects.all()
    lookup_field = 'slug'
    permission_classes = [AllowAny]
    
    def get_throttle_scope(self):
        """
        Понижаем скоп для подозрительных запросов
        """
        if SmartThrottle.is_suspicious_request(self.request):
            return 'read_light'  # 120/min - мягко режем скорость
        return 'read_heavy'  # 240/min - обычная скорость для деталей книг
    
    def get(self, request, *args, **kwargs):
        """
        Перевизначаємо get метод для додаткової перевірки прав доступу до налаштувань
        """
        response = super().get(request, *args, **kwargs)
        
        # Якщо запит йде з фронтенду для отримання налаштувань доступу
        # (перевіряємо по заголовку або параметру)
        if request.headers.get('X-Requested-With') == 'AccessRights' and request.user.is_authenticated:
            book = self.get_object()
            if book.owner != request.user:
                return Response(
                    {'error': 'У вас немає прав для перегляду налаштувань доступу цієї книги'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return response
    
    def get_serializer_class(self):
        class BookInfoSerializer(serializers.ModelSerializer):
            image = serializers.SerializerMethodField()
            owner_username = serializers.SerializerMethodField()
            creator_username = serializers.SerializerMethodField()
            translation_status_display = serializers.CharField(source='get_translation_status_display', read_only=True)
            original_status_display = serializers.CharField(source='get_original_status_display', read_only=True)
            genres = GenresSerializer(many=True, read_only=True)
            tags = TagSerializer(many=True, read_only=True)
            fandoms = FandomSerializer(many=True, read_only=True)
            country = CountrySerializer(read_only=True)

            class Meta:
                model = Book
                fields = [
                    'id', 'title', 'title_en', 'author', 'description', 
                    'image', 'translation_status_display', 
                    'original_status_display', 'country', 'slug', 
                    'last_updated', 'owner', 'creator', 'adult_content',
                    'owner_username', 'creator_username', 'book_type',
                    'genres', 'tags', 'fandoms', 'view_permission', 
                    'comment_book_permission', 'comment_chapter_permission',
                    'download_permission', 'rate_permission'
                ]
                read_only_fields = fields

            def get_image(self, obj):
                if obj.image:
                    request = self.context.get('request')
                    if request:
                        return request.build_absolute_uri(obj.image.url)
                    return obj.image.url
                return None

            def get_owner_username(self, obj):
                return obj.owner.username if obj.owner else None

            def get_creator_username(self, obj):
                return obj.creator.username if obj.creator else None

        return BookInfoSerializer


@api_view(['GET'])
def check_book_access(request, slug):
    """
    Перевіряє права доступу користувача до книги
    """
    try:
        book = get_object_or_404(Book, slug=slug)
        
        # Перевіряємо права доступу до перегляду книги
        is_allowed, error_message = check_book_access_permission(
            request.user, book, 'view'
        )
        
        return Response({
            'has_access': is_allowed,
            'message': error_message if not is_allowed else None,
            'book_title': book.title
        }, status=status.HTTP_200_OK)
        
    except Book.DoesNotExist:
        return Response(
            {'has_access': False, 'message': 'Книга не знайдена'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error checking book access for {slug}: {e}")
        return Response(
            {'has_access': False, 'message': 'Помилка при перевірці доступу'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsBookOwner])
def update_book_access_rights(request, slug):
    """
    Оновлення налаштувань доступу до книги
    """
    try:
        book = get_object_or_404(Book, slug=slug)
        
        # Додаткова перевірка власника (на випадок, якщо IsBookOwner не спрацював)
        if book.owner != request.user:
            logger.warning(f"Unauthorized access attempt to book {slug} by user {request.user.id}")
            return Response(
                {'error': 'У вас немає прав для зміни налаштувань цієї книги'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Список дозволених полів для оновлення
        allowed_fields = [
            'view_permission', 'comment_book_permission', 
            'comment_chapter_permission', 'download_permission', 
            'rate_permission'
        ]
        
        # Оновлюємо тільки дозволені поля
        updated_fields = []
        for field in allowed_fields:
            if field in request.data:
                value = request.data[field]
                # Валідуємо значення
                if value in ['all', 'bookmarked', 'none']:
                    setattr(book, field, value)
                    updated_fields.append(field)
                else:
                    return Response(
                        {'error': f'Недійсне значення для поля {field}: {value}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        if updated_fields:
            book.save(update_fields=updated_fields)
            return Response({
                'message': 'Налаштування доступу успішно оновлено',
                'updated_fields': updated_fields
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Не надано жодного поля для оновлення'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except Exception as e:
        logger.error(f"Помилка при оновленні налаштувань доступу: {str(e)}")
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def abandoned_translations(request):
    """API для отримання списку покинутих перекладів"""
    try:
        # Отримуємо тільки книги зі статусом 'ABANDONED'
        abandoned_books = Book.objects.filter(
            translation_status='ABANDONED'
        ).select_related('owner', 'creator').prefetch_related(
            'genres', 'tags', 'fandoms', 'country'
        )
        
        serializer = BookReaderSerializer(abandoned_books, many=True, context={'request': request})
        return Response(serializer.data, status=HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Помилка в abandoned_translations: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_book_view(request, book_id):
    """API для регистрации просмотра книги"""
    try:
        from apps.catalog.models import Book
        from apps.monitoring.models import BookView
        from django.utils import timezone
        
        book = get_object_or_404(Book, id=book_id)
        today = timezone.now().date()
        
        # Проверяем, не просматривал ли пользователь книгу сегодня
        existing_view = BookView.objects.filter(
            user=request.user,
            book=book,
            viewed_at__date=today
        ).first()
        
        if not existing_view:
            # Регистрируем новый просмотр
            BookView.objects.create(
                user=request.user,
                book=book,
                ip_address=request.META.get('REMOTE_ADDR')
            )
        
        return Response({'message': 'Просмотр зарегистрирован'})
        
    except Exception as e:
        logger.error(f"Помилка в register_book_view: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )
