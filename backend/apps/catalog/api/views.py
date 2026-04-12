from rest_framework.response import Response
from apps.catalog.models import Book, Chapter, Genres, Tag, Country, Fandom, Volume, ChapterOrder, ChapterOrderContainer
from apps.catalog.api.serializers import (
    ChapterSerializer, GenresSerializer, TagSerializer,
    CountrySerializer, FandomSerializer, VolumeSerializer, ChapterOrderSerializer,
    BookOwnerSerializer, BookReaderSerializer, BookCreateSerializer
)
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR
from rest_framework import status
import os
import logging
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAuthenticated
from apps.navigation.models import Bookmark
from django.db import transaction
from django.db.models import Max
from django.db import IntegrityError
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from django.conf import settings
from django.utils.translation import gettext as _
from django.utils import timezone
from apps.catalog.utils.errorUtils import get_error_codes
from apps.catalog.utils import validate_docx_file
from apps.catalog.api.permissions import (
    IsBookOwner,
    IsNotBookOwner,
    check_book_access_permission,
    is_book_owner_or_creator,
    require_book_view_access,
)
from rest_framework import generics
from rest_framework import serializers
from django.utils.text import slugify
import uuid
# Удаляем импорт старых throttling классов
from apps.core.smart_throttling import SmartThrottle
from apps.users.models import Profile

logger = logging.getLogger(__name__)

BOOK_CREATE_READER_FORBIDDEN_MESSAGE_UK = (
    "Читачі не можуть створювати книги. Щоб отримати це право, змініть тип профілю на сторінці «Профіль»."
)
BOOK_TRANSLATOR_AUTHOR_FORBIDDEN_MESSAGE_UK = (
    "Ми з радістю вітаємо авторські твори на платформі! "
    "Публікувати твір з типом «Авторський» можуть лише літератори. "
    "Змініть тип профілю на сторінці «Профіль»."
)


def _user_profile_role(user):
    try:
        return user.profile.role
    except Profile.DoesNotExist:
        return "Читач"


@api_view(['GET'])
@permission_classes([AllowAny])
def genres_list(request):
    genres = Genres.objects.all()
    serializer = GenresSerializer(genres, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def tags_list(request):
    tags = Tag.objects.all()
    serializer = TagSerializer(tags, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def countries_list(request):
    countries = Country.objects.all()
    serializer = CountrySerializer(countries, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def fandoms_list(request):
    fandoms = Fandom.objects.all()
    serializer = FandomSerializer(fandoms, many=True)
    return Response(serializer.data, status=HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
def chapter_list(request, book_slug):
    try:
        book = Book.objects.get(slug=book_slug)
        err = require_book_view_access(request.user, book)
        if err:
            return err

        chapters = Chapter.objects.filter(book=book).select_related('volume').order_by(
            'volume__order', 'order'
        )
        purchased_chapter_ids = set()
        if request.user.is_authenticated and not is_book_owner_or_creator(request.user, book):
            from apps.subscription.services import get_user_chapter_access_ids
            purchased_chapter_ids = get_user_chapter_access_ids(
                request.user,
                chapters.values_list('id', flat=True),
            )
        serializer = ChapterSerializer(
            chapters,
            many=True,
            context={
                'request': request,
                'purchased_chapter_ids': purchased_chapter_ids,
            }
        )
        containers = ChapterOrderContainer.objects.filter(
            book=book
        ).values('volume_id', 'version')
        container_versions = {str(c['volume_id']) if c['volume_id'] else 'null': c['version'] for c in containers}
        volumes = Volume.objects.filter(book=book).order_by('order', 'created_at')
        volumes_data = VolumeSerializer(volumes, many=True).data
        return Response({
            'chapters': serializer.data,
            'container_versions': container_versions,
            'volumes': volumes_data,
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
@permission_classes([AllowAny])
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
                from apps.subscription.services import user_has_chapter_access
                is_purchased = user_has_chapter_access(request.user, chapter.id)
                if not is_purchased:
                    return Response(
                        {
                            "error": "Необхідно придбати главу для перегляду",
                            "chapter_id": chapter.id,
                            "requires_purchase": True,
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )
        
        html_content = chapter.rendered_html

        if not html_content:
            if chapter.content_json:
                chapter.rebuild_derived()
                chapter.save(
                    update_fields=[
                        "rendered_html",
                        "html_content",
                        "plain_text",
                        "plain_text_length",
                        "toc_json",
                        "reading_time",
                        "min_reading_time",
                        "character_count",
                        "characters_count",
                    ]
                )
                html_content = chapter.rendered_html
            elif chapter.file and os.path.exists(chapter.file.path):
                try:
                    from apps.catalog.services.docx_to_json import docx_to_content_json

                    content_json = docx_to_content_json(
                        docx_path=chapter.file.path,
                        media_dir=settings.MEDIA_ROOT,
                        book_slug=chapter.book.slug,
                        chapter_slug=chapter.slug,
                    )
                    chapter.save_content(content_json)
                    html_content = chapter.rendered_html
                except Exception:
                    return Response(
                        {"error": "Помилка при конвертації файлу розділу"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
            else:
                html_content = chapter.html_content or chapter.get_html_content()

        if not html_content:
            return Response(
                {"error": "Контент розділ недступний"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        book_owner_id = chapter.book.owner.id if chapter.book.owner else None
        logger.debug(
            "ChapterDetail API: book_id=%s chapter_id=%s book_owner_id=%s",
            chapter.book.id,
            chapter.id,
            book_owner_id,
        )

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
        title = request.data.get("title")
        if not title or not str(title).strip():
            return Response(
                {"error": "Назва розділу обов'язкова"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        title = str(title).strip()
        if len(title) > 255:
            return Response(
                {"error": "Назва розділу занадто довга (макс. 255 символів)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            
        uploaded = request.FILES.get("file")
        editor_content_raw = request.data.get("editor_content")
        editor_content_parsed = None

        if uploaded is not None:
            file_error = validate_docx_file(uploaded)
            if file_error:
                return Response({"error": file_error}, status=status.HTTP_400_BAD_REQUEST)
        elif editor_content_raw:
            try:
                import json as _json

                editor_content = (
                    _json.loads(editor_content_raw)
                    if isinstance(editor_content_raw, str)
                    else editor_content_raw
                )
            except (_json.JSONDecodeError, TypeError, ValueError):
                return Response(
                    {"error": "Некоректний JSON у полі editor_content"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(editor_content, dict):
                return Response(
                    {"error": "editor_content має бути об'єктом JSON"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from apps.catalog.services.content_utils import (
                validate_content_json,
                content_json_byte_size,
                MAX_CONTENT_JSON_SIZE,
            )

            if content_json_byte_size(editor_content) > MAX_CONTENT_JSON_SIZE:
                return Response(
                    {"error": "Контент занадто великий (макс. 5 МБ)"},
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
            if not validate_content_json(editor_content):
                return Response(
                    {"error": "Невалідна структура контенту"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            editor_content_parsed = editor_content

        vol_id = int(volume_id) if volume_id else None
        if vol_id is not None:
            if not Volume.objects.filter(id=vol_id, book=book).exists():
                return Response(
                    {'error': 'Обраний том не належить цій книзі'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        with transaction.atomic():
            Book.objects.select_for_update().get(id=book.id)
            agg = Chapter.objects.filter(book=book, volume_id=vol_id).aggregate(Max('order'))
            next_order = (agg['order__max'] or 0) + 1
            orig_type = ""
            if uploaded is not None:
                orig_type = "docx"
            elif editor_content_parsed is not None:
                orig_type = "editor"
            chapter = Chapter.objects.create(
                book=book,
                title=title,
                file=uploaded if uploaded is not None else None,
                original_file_type=orig_type,
                volume_id=vol_id,
                is_paid=is_paid,
                price=price,
                order=next_order,
            )

            if uploaded is not None and chapter.file:
                chapter.original_file = chapter.file
                chapter.save(update_fields=["original_file"])

            if uploaded is not None and chapter.file and os.path.exists(chapter.file.path):
                try:
                    from apps.catalog.services.docx_to_json import docx_to_content_json

                    content_json = docx_to_content_json(
                        docx_path=chapter.file.path,
                        media_dir=settings.MEDIA_ROOT,
                        book_slug=book.slug,
                        chapter_slug=chapter.slug,
                    )
                    chapter.save_content(content_json)
                except Exception as e:
                    logger.error("Помилка конвертації .docx для глави %s: %s", chapter.id, str(e))
            elif editor_content_parsed is not None:
                from apps.catalog.services.content_utils import relocate_temp_images

                relocated = relocate_temp_images(
                    editor_content_parsed,
                    request.user.id,
                    book.slug,
                    chapter.slug,
                    settings.MEDIA_ROOT,
                    settings.MEDIA_URL,
                )
                chapter.save_content(relocated)

            book.last_updated = timezone.now()
            book.save(update_fields=['last_updated'])
        Book.mark_translation_owner_activity(book)
        
        serializer = ChapterSerializer(chapter)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.exception("add_chapter error for book=%s: %s", slug, e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

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
        err = require_book_view_access(request.user, instance)
        if err:
            return err

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
@permission_classes([AllowAny])
def volume_list(request, book_slug):
    book = get_object_or_404(Book, slug=book_slug)

    if request.method == 'GET':
        err = require_book_view_access(request.user, book)
        if err:
            return err
        volumes = Volume.objects.filter(book=book).order_by('order', 'created_at')
        serializer = VolumeSerializer(volumes, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Необхідна авторизація'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if request.user != book.owner:
            return Response(
                {'error': 'У вас немає прав для створення томів у цій книзі'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = VolumeSerializer(data={**request.data, 'book': book.id})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _get_unique_volume_title(book, base_title):
    """Якщо base_title вже існує, повертає унікальний варіант: «Новий том 2», «Новий том 3» тощо."""
    existing = set(Volume.objects.filter(book=book).values_list('title', flat=True))
    if base_title not in existing:
        return base_title
    for i in range(2, 1000):
        candidate = f"{base_title} {i}"
        if candidate not in existing:
            return candidate
    return f"{base_title} {int(timezone.now().timestamp())}"


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
        
        base_title = str(request.data['title']).strip() or 'Новий том'
        title = _get_unique_volume_title(book, base_title)
            
        with transaction.atomic():
            max_order = Volume.objects.filter(book=book).aggregate(Max('order'))['order__max'] or 0
            volume = Volume.objects.create(
                book=book,
                title=title,
                order=max_order + 1,
            )
        
        serializer = VolumeSerializer(volume)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Book.DoesNotExist:
        return Response(
            {'error': 'Книгу не знайдено'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except IntegrityError:
        return Response(
            {'error': 'Том з такою назвою вже існує. Спробуйте іншу назву.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.exception("create_volume failed: %s", e)
        if settings.DEBUG:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response(
            {'error': 'Внутрішня помилка сервера'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
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
        
        profile_role = _user_profile_role(request.user)
        if profile_role == "Читач":
            return Response(
                {
                    "error": "Недостатньо прав",
                    "message": BOOK_CREATE_READER_FORBIDDEN_MESSAGE_UK,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        book_type = data.get("book_type") if isinstance(data, dict) else None
        if profile_role == "Перекладач" and book_type == "AUTHOR":
            return Response(
                {
                    "error": "Помилка даних",
                    "message": BOOK_TRANSLATOR_AUTHOR_FORBIDDEN_MESSAGE_UK,
                    "details": {"book_type": BOOK_TRANSLATOR_AUTHOR_FORBIDDEN_MESSAGE_UK},
                },
                status=HTTP_400_BAD_REQUEST,
            )

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

        profile_role = _user_profile_role(request.user)
        # Блокуємо лише спробу змінити/задати «Авторський» для перекладача (не legacy-книги, що вже AUTHOR).
        incoming_book_type = (
            data.get("book_type") if isinstance(data, dict) and "book_type" in data else None
        )
        if (
            profile_role == "Перекладач"
            and incoming_book_type == "AUTHOR"
            and book.book_type != "AUTHOR"
        ):
            return Response(
                {
                    "error": "Помилка даних",
                    "message": BOOK_TRANSLATOR_AUTHOR_FORBIDDEN_MESSAGE_UK,
                    "details": {"book_type": BOOK_TRANSLATOR_AUTHOR_FORBIDDEN_MESSAGE_UK},
                },
                status=HTTP_400_BAD_REQUEST,
            )

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
        Book.mark_translation_owner_activity(book)
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
        Перевірка view_permission перед поверненням даних книги.
        Власник/творець завжди має доступ; для інших — згідно з налаштуваннями книги.
        """
        book = self.get_object()
        err = require_book_view_access(request.user, book)
        if err:
            return err
        return super().get(request, *args, **kwargs)
    
    def get_serializer_class(self):
        access_fields = [
            'view_permission', 'comment_book_permission', 'comment_chapter_permission',
            'download_permission', 'rate_permission'
        ]

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
                    'genres', 'tags', 'fandoms',
                ] + access_fields
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

            def to_representation(self, instance):
                data = super().to_representation(instance)
                request = self.context.get('request')
                if request and not is_book_owner_or_creator(request.user, instance):
                    for key in access_fields:
                        data.pop(key, None)
                return data

        return BookInfoSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
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
@permission_classes([AllowAny])
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
    """Унікальний перегляд на користувача на день + інкремент аналітики."""
    try:
        from apps.catalog.models import Book
        from apps.analytics_books.services.analytics_counters import (
            record_unique_book_view_from_request,
        )

        book = get_object_or_404(Book, id=book_id)
        counted = record_unique_book_view_from_request(request, book)
        return Response(
            {
                "message": "Перегляд зареєстровано" if counted else "Перегляд сьогодні вже враховано",
                "counted": counted,
            }
        )

    except Exception as e:
        logger.error(f"Помилка в register_book_view: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера'}, 
            status=HTTP_500_INTERNAL_SERVER_ERROR
        )
