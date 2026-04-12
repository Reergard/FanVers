import uuid

from rest_framework import status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.conf import settings
from apps.catalog.models import Chapter, Volume, Book, ChapterOrderContainer
from apps.catalog.api.serializers import ChapterSerializer
import os
from rest_framework.permissions import IsAuthenticated
from rest_framework import mixins, viewsets
from django.db.models import Q
from ..models import ErrorReport
from .serializers import ErrorReportSerializer
import logging
from apps.catalog.utils import (
    validate_docx_file,
    write_uploaded_docx_to_temp,
    clear_chapter_docx_filefields,
    delete_files_on_disk,
)
from apps.editors.image_upload import (
    ALLOWED_EDITOR_IMAGE_TYPES,
    MAX_EDITOR_IMAGE_BYTES,
    check_temp_editor_upload_rate,
    validate_editor_image_raw,
)

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chapter_for_edit(request, chapter_id):
    chapter = get_object_or_404(Chapter, id=chapter_id)
    if request.user != chapter.book.owner:
        return Response(
            {'error': 'У вас немає прав для редагування цього розділу'},
            status=status.HTTP_403_FORBIDDEN
        )
    serializer = ChapterSerializer(chapter, context={'request': request})
    return Response(serializer.data)

@api_view(['PUT'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def update_chapter(request, chapter_id):
    chapter = get_object_or_404(Chapter, id=chapter_id)
    if request.user != chapter.book.owner:
        return Response(
            {'error': 'У вас немає прав для редагування цього розділу'},
            status=status.HTTP_403_FORBIDDEN
        )

    new_uploaded_file = request.FILES.get("file")
    files_to_delete: list[str] = []

    try:
        with transaction.atomic():
            chapter = Chapter.objects.select_for_update().select_related("book").get(id=chapter_id)
            if request.user != chapter.book.owner:
                return Response(
                    {'error': 'У вас немає прав для редагування цього розділу'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if "title" in request.data:
                new_title = request.data["title"]
                if not new_title or not str(new_title).strip():
                    return Response(
                        {"error": "Назва розділу не може бути порожньою"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                new_title = str(new_title).strip()
                if len(new_title) > 255:
                    return Response(
                        {"error": "Назва розділу занадто довга (макс. 255 символів)"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                chapter.title = new_title

            if "is_paid" in request.data:
                chapter.is_paid = request.data.get("is_paid") == "true"
                if chapter.is_paid and "price" in request.data:
                    try:
                        price = float(request.data["price"])
                        if price > 0 and price <= 1000:
                            chapter.price = price
                    except (ValueError, TypeError):
                        return Response(
                            {"error": "Некоректна ціна"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                elif not chapter.is_paid:
                    chapter.price = 1.00

            if "volume" in request.data:
                volume_id = request.data.get("volume")
                if volume_id:
                    vol = Volume.objects.filter(id=volume_id, book=chapter.book).first()
                    if not vol:
                        return Response(
                            {"error": "Обраний том не належить цій книзі"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    chapter.volume = vol
                else:
                    chapter.volume = None

            if new_uploaded_file is not None:
                file_error = validate_docx_file(new_uploaded_file)
                if file_error:
                    return Response({"error": file_error}, status=status.HTTP_400_BAD_REQUEST)

                ev_raw = request.data.get("expected_version")
                if ev_raw is not None and ev_raw != "":
                    try:
                        ev = int(ev_raw)
                    except (TypeError, ValueError):
                        return Response(
                            {"error": "expected_version має бути цілим числом"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if chapter.content_version != ev:
                        return Response(
                            {
                                "error": "conflict",
                                "detail": "Контент змінено в іншій вкладці. Оновіть сторінку перед завантаженням .docx.",
                                "server_version": chapter.content_version,
                            },
                            status=status.HTTP_409_CONFLICT,
                        )

            chapter.save()

            if new_uploaded_file is not None:
                tmp_path = write_uploaded_docx_to_temp(new_uploaded_file)
                try:
                    from apps.catalog.services.docx_to_json import docx_to_content_json

                    content_json = docx_to_content_json(
                        docx_path=tmp_path,
                        media_dir=settings.MEDIA_ROOT,
                        book_slug=chapter.book.slug,
                        chapter_slug=chapter.slug,
                    )
                    chapter.save_content(content_json)
                    files_to_delete = clear_chapter_docx_filefields(chapter)
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

            Book.mark_translation_owner_activity(chapter.book)

        # Транзакція закомічена — тепер безпечно видаляємо файли з диску
        delete_files_on_disk(files_to_delete)

        chapter.refresh_from_db()
        serializer = ChapterSerializer(chapter, context={"request": request})
        return Response(serializer.data)

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_chapter_content_json(request, chapter_id):
    try:
        chapter = Chapter.objects.select_related("book").get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Главу не знайдено"}, status=404)

    if request.user != chapter.book.owner:
        return Response({"error": "Доступ заборонено"}, status=403)

    with transaction.atomic():
        chapter = Chapter.objects.select_for_update().select_related("book").get(id=chapter_id)
        if request.user != chapter.book.owner:
            return Response({"error": "Доступ заборонено"}, status=403)

        if not chapter.content_json:
            if chapter.file and os.path.exists(chapter.file.path):
                from apps.catalog.services.docx_to_json import docx_to_content_json

                content_json = docx_to_content_json(
                    docx_path=chapter.file.path,
                    media_dir=settings.MEDIA_ROOT,
                    book_slug=chapter.book.slug,
                    chapter_slug=chapter.slug,
                )
                chapter.save_content(content_json)
            elif chapter.html_content:
                from apps.catalog.services.html_to_json import html_to_content_json

                content_json = html_to_content_json(chapter.html_content)
                chapter.save_content(content_json)
            else:
                return Response(
                    {
                        "content_json": {"type": "doc", "content": [{"type": "paragraph"}]},
                        "content_version": chapter.content_version,
                    }
                )

    chapter.refresh_from_db()
    return Response(
        {
            "content_json": chapter.content_json,
            "content_version": chapter.content_version,
        }
    )


@api_view(["PUT", "POST"])
@parser_classes([JSONParser])
@permission_classes([IsAuthenticated])
def save_chapter_content(request, chapter_id):
    try:
        chapter = Chapter.objects.select_related("book").get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Главу не знайдено"}, status=404)

    if request.user != chapter.book.owner:
        return Response({"error": "Доступ заборонено"}, status=403)

    content_json = request.data.get("content")
    if not content_json:
        return Response({"error": "Поле content обов'язкове"}, status=400)

    if not isinstance(content_json, dict):
        return Response({"error": "content повинен бути JSON-об'єктом"}, status=400)

    from apps.catalog.services.content_utils import (
        validate_content_json,
        content_json_byte_size,
        MAX_CONTENT_JSON_SIZE,
        relocate_temp_images,
    )

    if content_json_byte_size(content_json) > MAX_CONTENT_JSON_SIZE:
        return Response({"error": "Контент занадто великий (макс. 5 МБ)"}, status=413)

    if not validate_content_json(content_json):
        return Response({"error": "Невалідна структура контенту"}, status=400)

    expected_version = request.data.get("expected_version")
    try:
        with transaction.atomic():
            chapter = Chapter.objects.select_for_update().select_related("book").get(id=chapter_id)
            if request.user != chapter.book.owner:
                return Response({"error": "Доступ заборонено"}, status=403)

            if expected_version is not None:
                try:
                    ev = int(expected_version)
                except (TypeError, ValueError):
                    return Response(
                        {"error": "expected_version має бути цілим числом"},
                        status=400,
                    )
                if chapter.content_version != ev:
                    return Response(
                        {
                            "error": "conflict",
                            "detail": "Версію контенту змінено в іншій вкладці. Перезавантажте редактор.",
                            "server_version": chapter.content_version,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            content_json = relocate_temp_images(
                content_json,
                request.user.id,
                chapter.book.slug,
                chapter.slug,
                settings.MEDIA_ROOT,
                settings.MEDIA_URL,
            )
            chapter.save_content(content_json)
    except ValueError as e:
        return Response({"error": str(e)}, status=400)
    except Exception as e:
        return Response({"error": f"Помилка збереження: {str(e)}"}, status=500)

    return Response(
        {
            "status": "ok",
            "content_version": chapter.content_version,
            "characters_count": chapter.plain_text_length,
        }
    )


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def upload_editor_image(request, chapter_id):
    """Завантаження зображення для вставки в редактор (власник глави)."""
    try:
        chapter = Chapter.objects.select_related("book").get(id=chapter_id)
    except Chapter.DoesNotExist:
        return Response({"error": "Главу не знайдено"}, status=404)

    if request.user != chapter.book.owner:
        return Response({"error": "Доступ заборонено"}, status=403)

    image_file = request.FILES.get("image")
    if not image_file:
        return Response({"error": "Файл зображення обов'язковий"}, status=400)

    ctype = (image_file.content_type or "").lower()
    if ctype not in ALLOWED_EDITOR_IMAGE_TYPES:
        return Response(
            {"error": "Дозволені формати: JPEG, PNG, GIF, WebP"},
            status=400,
        )

    if image_file.size > MAX_EDITOR_IMAGE_BYTES:
        return Response({"error": "Макс. розмір зображення — 5 МБ"}, status=400)

    raw = image_file.read()
    ext, verr = validate_editor_image_raw(raw)
    if verr or not ext:
        return Response({"error": verr or "Невалідне зображення"}, status=400)

    filename = f"{chapter.slug}_{uuid.uuid4().hex[:10]}.{ext}"
    rel_path = os.path.join("books", chapter.book.slug, "chapters", "images", filename)
    rel_path = rel_path.replace("\\", "/")
    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "wb") as out:
        out.write(raw)

    url = f"{settings.MEDIA_URL.rstrip('/')}/{rel_path}"
    return Response({"url": url}, status=status.HTTP_201_CREATED)


upload_editor_image.throttle_scope = "editor_chapter_image"


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def upload_temp_image(request):
    """Тимчасове зображення до створення глави (лише для поточного користувача)."""
    if not check_temp_editor_upload_rate(request.user.id):
        return Response(
            {"error": "Забагато завантажень. Спробуйте через кілька хвилин."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    image_file = request.FILES.get("image")
    if not image_file:
        return Response({"error": "Файл зображення обов'язковий"}, status=400)

    ctype = (image_file.content_type or "").lower()
    if ctype not in ALLOWED_EDITOR_IMAGE_TYPES:
        return Response(
            {"error": "Дозволені формати: JPEG, PNG, GIF, WebP"},
            status=400,
        )

    if image_file.size > MAX_EDITOR_IMAGE_BYTES:
        return Response({"error": "Макс. розмір зображення — 5 МБ"}, status=400)

    raw = image_file.read()
    ext, verr = validate_editor_image_raw(raw)
    if verr or not ext:
        return Response({"error": verr or "Невалідне зображення"}, status=400)

    uid = int(request.user.id)
    fname = f"{uuid.uuid4().hex[:12]}.{ext}"
    rel_path = os.path.join("tmp", "editor-images", str(uid), fname)
    rel_path = rel_path.replace("\\", "/")
    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path.replace("/", os.sep))
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "wb") as out:
        out.write(raw)

    url = f"{settings.MEDIA_URL.rstrip('/')}/{rel_path}"
    return Response({"url": url}, status=status.HTTP_201_CREATED)


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


def _lock_containers_in_order(book_id, vol_a, vol_b):
    """Блокує два контейнери в детермінованому порядку (уникнення дедлоку)."""
    key_a = (book_id, vol_a if vol_a is not None else -1)
    key_b = (book_id, vol_b if vol_b is not None else -1)
    if key_a == key_b:
        return [ChapterOrderContainer.objects.select_for_update().get_or_create(
            book_id=book_id, volume_id=vol_a, defaults={'version': 1}
        )[0]]
    first_key, second_key = (key_a, key_b) if key_a < key_b else (key_b, key_a)
    first_vol = first_key[1] if first_key[1] != -1 else None
    second_vol = second_key[1] if second_key[1] != -1 else None
    containers = []
    for vid in (first_vol, second_vol):
        c, _ = ChapterOrderContainer.objects.select_for_update().get_or_create(
            book_id=book_id, volume_id=vid, defaults={'version': 1}
        )
        containers.append(c)
    return containers


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_chapter(request, book_slug, chapter_id):
    """
    POST /books/<slug>/chapters/<id>/move/
    Body: { to_volume_id: null|id, to_order?: number }
    """
    try:
        book = get_object_or_404(Book, slug=book_slug)
        if request.user != book.owner:
            return Response(
                {'error': 'У вас немає прав для переміщення глав'},
                status=status.HTTP_403_FORBIDDEN
            )
        chapter = get_object_or_404(Chapter, id=chapter_id, book=book)
        data = request.data
        to_volume_id = data.get('to_volume_id')
        to_order = data.get('to_order')

        to_vol_id = int(to_volume_id) if to_volume_id is not None else None
        if to_vol_id is not None:
            to_vol = get_object_or_404(Volume, id=to_vol_id)
            if to_vol.book_id != book.id:
                return Response(
                    {'error': 'Том не належить цій книзі'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        src_vol_id = chapter.volume_id
        if src_vol_id == to_vol_id:
            return Response(
                {'error': 'Розділ вже в цьому томі. Використовуйте зміну порядку.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        target_order = int(to_order) if to_order is not None else None
        if target_order is not None and target_order < 1:
            return Response(
                {'error': 'to_order має бути >= 1'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            Book.objects.select_for_update().get(id=book.id)
            _lock_containers_in_order(book.id, src_vol_id, to_vol_id)

            src_chapters = list(
                Chapter.objects.filter(book=book, volume_id=src_vol_id)
                .select_for_update().order_by('order', 'id')
            )
            tgt_chapters = list(
                Chapter.objects.filter(book=book, volume_id=to_vol_id)
                .select_for_update().order_by('order', 'id')
            )

            ch_in_src = next((c for c in src_chapters if c.id == chapter.id), None)
            if not ch_in_src:
                return Response(
                    {'error': 'Розділ не знайдено у вихідному контейнері'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            chapter.volume_id = to_vol_id
            if target_order is not None:
                if target_order > len(tgt_chapters) + 1:
                    target_order = len(tgt_chapters) + 1
                for c in tgt_chapters:
                    if c.order >= target_order:
                        c.order += 1
                        c.save(update_fields=['order'])
                chapter.order = target_order
            else:
                chapter.order = len(tgt_chapters) + 1
            chapter.save(update_fields=['volume_id', 'order'])

            _normalize_container_order(book.id, src_vol_id)
            _normalize_container_order(book.id, to_vol_id)

            for vid in (src_vol_id, to_vol_id):
                cont = ChapterOrderContainer.objects.get(book=book, volume_id=vid)
                cont.version += 1
                cont.save(update_fields=['version', 'updated_at'])

        chapters = list(
            Chapter.objects.filter(book=book)
            .select_related('volume')
            .order_by('volume__order', 'order')
        )
        serializer = ChapterSerializer(chapters, many=True, context={'request': request})
        containers = ChapterOrderContainer.objects.filter(book=book).values('volume_id', 'version')
        container_versions = {str(c['volume_id']) if c['volume_id'] else 'null': c['version'] for c in containers}
        return Response({
            'chapters': serializer.data,
            'container_versions': container_versions,
        }, status=status.HTTP_200_OK)

    except (ValueError, TypeError) as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reorder_chapters(request, book_slug):
    """
    POST /books/<slug>/chapters/reorder/
    Body: { volume_id: null|id, ordered_ids: [1,5,3,...], container_version?: int }
    """
    try:
        book = get_object_or_404(Book, slug=book_slug)
        if request.user != book.owner:
            return Response(
                {'error': 'У вас немає прав для зміни порядку глав'},
                status=status.HTTP_403_FORBIDDEN
            )
        data = request.data
        volume_id = data.get('volume_id')
        ordered_ids = data.get('ordered_ids', [])
        container_version = data.get('container_version')

        if not ordered_ids or not isinstance(ordered_ids, list):
            return Response(
                {'error': 'ordered_ids має бути непустим масивом'},
                status=status.HTTP_400_BAD_REQUEST
            )
        ordered_ids = [int(x) for x in ordered_ids]
        if len(ordered_ids) != len(set(ordered_ids)):
            return Response(
                {'error': 'ordered_ids має містити унікальні id'},
                status=status.HTTP_400_BAD_REQUEST
            )

        vol_id = int(volume_id) if volume_id is not None else None
        if vol_id is not None:
            vol = get_object_or_404(Volume, id=vol_id)
            if vol.book_id != book.id:
                return Response(
                    {'error': 'Том не належить цій книзі'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            container, _ = ChapterOrderContainer.objects.select_for_update().get_or_create(
                book=book,
                volume_id=vol_id,
                defaults={'version': 1},
            )
            if container_version is not None and container.version != container_version:
                chapters = list(
                    Chapter.objects.filter(book=book, volume_id=vol_id)
                    .order_by('order', 'id')
                )
                return Response(
                    {
                        'detail': 'Порядок змінено в іншій вкладці. Оновіть список.',
                        'container_version': container.version,
                        'chapters': [{'id': c.id, 'order': c.order} for c in chapters],
                    },
                    status=status.HTTP_409_CONFLICT
                )

            chapters = list(
                Chapter.objects.filter(id__in=ordered_ids, book=book, volume_id=vol_id)
                .select_for_update()
                .order_by('id')
            )
            if len(chapters) != len(ordered_ids):
                return Response(
                    {'error': 'Деякі глави не знайдено або не належать цьому контейнеру'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            container_chapters = list(
                Chapter.objects.filter(book=book, volume_id=vol_id).values_list('id', flat=True)
            )
            if set(container_chapters) != set(ordered_ids):
                return Response(
                    {'error': 'ordered_ids має містити всі глави контейнера'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            ch_by_id = {c.id: c for c in chapters}
            OFFSET = 100000
            for i, cid in enumerate(ordered_ids, start=1):
                ch = ch_by_id.get(cid)
                if ch and ch.order != i:
                    ch.order = OFFSET + ch.id
                    ch.save(update_fields=['order'])
            for i, cid in enumerate(ordered_ids, start=1):
                ch = ch_by_id.get(cid)
                if ch:
                    ch.order = i
                    ch.save(update_fields=['order'])
            container.version += 1
            container.save(update_fields=['version', 'updated_at'])

            chapters = list(
                Chapter.objects.filter(book=book, volume_id=vol_id)
                .order_by('order', 'id')
            )
            return Response({
                'volume_id': vol_id,
                'container_version': container.version,
                'chapters': [{'id': c.id, 'order': c.order} for c in chapters],
            }, status=status.HTTP_200_OK)

    except (ValueError, TypeError) as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ErrorReportViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ErrorReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ErrorReport.objects.filter(
            Q(book__owner=user) | Q(user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            raw_book = request.data.get("book_id", request.data.get("book"))
            book_id = int(raw_book) if raw_book is not None else None
            if book_id is None:
                return Response(
                    {
                        "error": "book_required",
                        "message": "Не вказано книгу",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            book = Book.objects.get(id=book_id)
            
            if not book.owner:
                return Response(
                    {
                        'error': 'no_owner',
                        'message': 'У книги відсутній перекладач'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return super().create(request, *args, **kwargs)

        except (ValueError, TypeError):
            return Response(
                {
                    "error": "invalid_book",
                    "message": "Некоректний ідентифікатор книги",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Book.DoesNotExist:
            return Response(
                {
                    'error': 'book_not_found',
                    'message': 'Книга не знайдена'
                },
                status=status.HTTP_404_NOT_FOUND
            )


