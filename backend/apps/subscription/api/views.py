import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.catalog.models import Book
from apps.catalog.api.permissions import is_book_owner_or_creator, check_book_access_permission

from ..models import BookSubscriptionSettings, UserBookSubscription
from ..services import (
    SubscriptionAdminService,
    SubscriptionService,
    INSUFFICIENT_BALANCE,
    PLAN_NOT_ACTIVE,
    PLAN_CHAPTER_COUNT_MISMATCH,
    CHAPTER_ALREADY_PURCHASED,
    ACTIVE_SUBSCRIPTION_ALREADY_EXISTS,
    INVALID_CHAPTER_SELECTION,
    SUBSCRIPTION_EXHAUSTED,
)
from .serializers import (
    BookSubscriptionSettingsSerializer,
    BookSubscriptionSettingsUpdateSerializer,
    UserBookSubscriptionSerializer,
    PurchasePlanSerializer,
    ApplyPlanSerializer,
)


class SubscriptionSettingsView(APIView):
    """GET/PUT налаштувань підписки для книги."""
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, book_slug):
        book = get_object_or_404(Book, slug=book_slug)
        is_allowed, err = check_book_access_permission(request.user, book, 'view')
        if not is_allowed:
            return Response(
                {'error': err or 'Доступ до книги заборонено'},
                status=status.HTTP_403_FORBIDDEN
            )
        settings = BookSubscriptionSettings.objects.filter(book=book).first()
        if not settings:
            # GET не створює запис — повертаємо дефолт без збереження в БД
            active_sub = None
            if request.user.is_authenticated:
                try:
                    active_sub = SubscriptionService.get_active_user_subscription_for_book(
                        request.user, book
                    )
                except ValueError:
                    active_sub = None
            data = {
                'id': None,
                'book': book.id,
                'book_slug': book.slug,
                'is_enabled': False,
                'plans': [],
                'created_at': None,
                'updated_at': None,
                'active_subscription': UserBookSubscriptionSerializer(active_sub).data if active_sub else None,
            }
            return Response(data)
        active_sub = None
        if request.user.is_authenticated:
            try:
                active_sub = SubscriptionService.get_active_user_subscription_for_book(
                    request.user, book
                )
            except ValueError:
                active_sub = None
        serializer = BookSubscriptionSettingsSerializer(settings)
        data = serializer.data
        data['active_subscription'] = UserBookSubscriptionSerializer(active_sub).data if active_sub else None
        return Response(data)

    def put(self, request, book_slug):
        book = get_object_or_404(Book, slug=book_slug)
        if not is_book_owner_or_creator(request.user, book):
            return Response(
                {'error': 'У вас немає прав для редагування цієї книги'},
                status=status.HTTP_403_FORBIDDEN
            )
        settings, _ = BookSubscriptionSettings.objects.get_or_create(
            book=book,
            defaults={'is_enabled': False}
        )
        serializer = BookSubscriptionSettingsUpdateSerializer(
            settings,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            updated_settings = serializer.save()
            return Response(BookSubscriptionSettingsSerializer(updated_settings).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def purchase_plan(request, book_slug):
    """Купити пакет "в запас" (prepaid)."""
    book = get_object_or_404(Book, slug=book_slug)
    serializer = PurchasePlanSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    plan_id = serializer.validated_data['plan_id']
    idempotency_key = serializer.validated_data['idempotency_key']

    success, result, detail = SubscriptionService.purchase_plan_for_future(
        request.user, book, plan_id, idempotency_key,
        request_id=request.META.get('HTTP_X_REQUEST_ID') or getattr(request, 'request_id', None)
    )
    if success:
        return Response({
            'message': 'Пакет успішно придбано',
            **result,
        })
    error_messages = {
        INSUFFICIENT_BALANCE: 'Недостатньо коштів на балансі',
        PLAN_NOT_ACTIVE: 'План не знайдено або неактивний',
        ACTIVE_SUBSCRIPTION_ALREADY_EXISTS: 'У вас вже є активний пакет для цієї книги',
        'ACCESS_DENIED': 'Доступ заборонено',
    }
    return Response(
        {'error': error_messages.get(result, detail or str(result)), 'code': result},
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_plan(request, book_slug):
    """Instant bulk: застосувати план до обраних глав."""
    logger = logging.getLogger(__name__)
    book = get_object_or_404(Book, slug=book_slug)
    serializer = ApplyPlanSerializer(data=request.data)
    if not serializer.is_valid():
        logger.warning('apply_plan validation failed: %s', serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    plan_id = serializer.validated_data['plan_id']
    chapter_ids = serializer.validated_data['chapter_ids']
    idempotency_key = serializer.validated_data['idempotency_key']

    success, result, detail = SubscriptionService.apply_plan_to_selected_chapters(
        request.user, book.id, plan_id, chapter_ids, idempotency_key,
        request_id=request.META.get('HTTP_X_REQUEST_ID') or getattr(request, 'request_id', None)
    )
    if not success:
        logger.warning('apply_plan failed: code=%s detail=%s plan_id=%s chapters=%s',
                       result, detail, plan_id, len(chapter_ids))
    if success:
        return Response({
            'message': 'Розділи успішно придбано',
            **result,
        })
    error_messages = {
        INSUFFICIENT_BALANCE: 'Недостатньо коштів на балансі',
        PLAN_NOT_ACTIVE: 'План не знайдено або це план типу «Пакет» — для миттєвої покупки потрібен план «Миттєва покупка обраних»',
        PLAN_CHAPTER_COUNT_MISMATCH: 'Оберіть щонайменше стільки розділів, скільки вказано в плані',
        CHAPTER_ALREADY_PURCHASED: 'Один або кілька розділів вже придбані',
        INVALID_CHAPTER_SELECTION: 'Невірний вибір розділів або не вдалося розрахувати ціну',
        'ACCESS_DENIED': 'Доступ заборонено',
    }
    return Response(
        {'error': error_messages.get(result, detail or str(result)), 'code': result},
        status=status.HTTP_400_BAD_REQUEST
    )


class UserSubscriptionsView(APIView):
    """Список підписок користувача: активні + історія."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        active = UserBookSubscription.objects.filter(
            user=request.user,
            status=UserBookSubscription.STATUS_ACTIVE,
            remaining_chapters_count__gt=0,
        ).select_related('book', 'plan')
        history = UserBookSubscription.objects.filter(
            user=request.user,
        ).exclude(
            status=UserBookSubscription.STATUS_ACTIVE,
            remaining_chapters_count__gt=0,
        ).select_related('book', 'plan').order_by('-updated_at')[:50]

        return Response({
            'active': UserBookSubscriptionSerializer(active, many=True).data,
            'history': UserBookSubscriptionSerializer(history, many=True).data,
        })


def _get_request_id(request):
    return (
        request.META.get('HTTP_X_REQUEST_ID') or
        getattr(request, 'request_id', None) or
        ''
    ) or None


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_restore_slot(request, subscription_id):
    """Повернути 1 слот до prepaid-пакета."""
    chapter_id = request.data.get('chapter_id')
    reason = request.data.get('reason', '')
    if not chapter_id:
        return Response({'error': 'chapter_id обов\'язковий'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        success, result, err = SubscriptionAdminService.restore_slot(
            subscription_id, chapter_id, request.user, reason,
            request_id=_get_request_id(request)
        )
        if success:
            return Response({'message': 'Слот повернено', 'remaining': result})
        return Response({'error': err, 'code': result}, status=status.HTTP_400_BAD_REQUEST)
    except UserBookSubscription.DoesNotExist:
        return Response({'error': 'Підписку не знайдено'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_refund_fancoins(request, subscription_id):
    """Повернути FanCoins за пакет."""
    reason = request.data.get('reason', '')
    try:
        success, new_balance, err = SubscriptionAdminService.refund_fancoins(
            subscription_id, request.user, reason,
            request_id=_get_request_id(request)
        )
        if success:
            return Response({'message': 'FanCoins повернено', 'new_balance': new_balance})
        if err == 'ALREADY_REFUNDED':
            return Response(
                {'error': 'Кошти за цей пакет вже повернено', 'code': 'ALREADY_REFUNDED'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    except UserBookSubscription.DoesNotExist:
        return Response({'error': 'Підписку не знайдено'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_close_pack(request, subscription_id):
    """Закрити пакет (status=cancelled)."""
    reason = request.data.get('reason', '')
    try:
        success, _, err = SubscriptionAdminService.close_pack(
            subscription_id, request.user, reason,
            request_id=_get_request_id(request)
        )
        if success:
            return Response({'message': 'Пакет закрито'})
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    except UserBookSubscription.DoesNotExist:
        return Response({'error': 'Підписку не знайдено'}, status=status.HTTP_404_NOT_FOUND)
