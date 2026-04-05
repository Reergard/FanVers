from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.catalog.models import Chapter, Volume, Book, ChapterOrderContainer
from apps.catalog.api.serializers import ChapterSerializer
from .serializers import ChapterEditSerializer
import os
from rest_framework.permissions import IsAuthenticated
from rest_framework import mixins, viewsets
from django.db.models import Q
from ..models import ErrorReport
from .serializers import ErrorReportSerializer

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
    
    try:
        old_file = chapter.file if chapter.file else None
        
        if 'title' in request.data:
            chapter.title = request.data['title']
            
        if 'is_paid' in request.data:
            chapter.is_paid = request.data.get('is_paid') == 'true'
            if chapter.is_paid and 'price' in request.data:
                try:
                    price = float(request.data['price'])
                    if price > 0 and price <= 1000:
                        chapter.price = price
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'Некоректна ціна'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif not chapter.is_paid:
                chapter.price = 1.00
            
        if 'volume' in request.data:
            volume_id = request.data.get('volume')
            if volume_id:
                vol = Volume.objects.filter(id=volume_id, book=chapter.book).first()
                if not vol:
                    return Response(
                        {'error': 'Обраний том не належить цій книзі'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                chapter.volume = vol
            else:
                chapter.volume = None

        if 'file' in request.FILES:
            if old_file:
                if os.path.isfile(old_file.path):
                    os.remove(old_file.path)
            chapter.file = request.FILES['file']

        chapter.save()
        Book.mark_translation_owner_activity(chapter.book)

        serializer = ChapterSerializer(chapter, context={'request': request})
        return Response(serializer.data)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
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


