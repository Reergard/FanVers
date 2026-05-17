from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.throttling import ScopedRateThrottle
from django.db import transaction, IntegrityError

from .serializers import (
    UpdateBalanceSerializer,
    BalanceOperationSerializer
)
from .mixins import BalanceOperationMixin
from apps.users.models import BalanceIdempotencyRecord
from apps.users.balance_access import (
    API_WITHDRAW_ROLE_FORBIDDEN_CODE,
    API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE,
    profile_can_request_balance_withdraw,
)
import logging

logger = logging.getLogger(__name__)


class AddBalanceView(APIView):
    permission_classes = [IsAdminUser]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'balance'

    def post(self, request):
        serializer = UpdateBalanceSerializer(data=request.data)
        if serializer.is_valid():
            try:
                idempotency_key = (request.data or {}).get("idempotency_key") or ""
                if not str(idempotency_key).strip():
                    return Response(
                        {"error": "idempotency_key обов'язковий для захисту від дублювання"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                amount = serializer.validated_data['amount']
                balance_mixin = BalanceOperationMixin()
                with transaction.atomic():
                    try:
                        BalanceIdempotencyRecord.objects.create(
                            user=request.user,
                            key=str(idempotency_key).strip(),
                            operation_type=BalanceIdempotencyRecord.OP_DEPOSIT,
                        )
                    except IntegrityError:
                        # Already processed - return current balance.
                        return Response(
                            {
                                "already_processed": True,
                                "new_balance": str(request.user.profile.balance),
                            },
                            status=status.HTTP_200_OK,
                        )

                    new_balance = balance_mixin.perform_balance_operation(
                        request.user.profile,
                        amount,
                        'deposit'
                    )
                # Alias URL update-balance/ — та сама логіка, інше повідомлення для сумісності.
                path = (request.path or "").rstrip("/")
                ok_message = (
                    "Баланс успішно оновлено"
                    if path.endswith("update-balance")
                    else "Баланс успішно поповнено"
                )
                return Response({
                    'message': ok_message,
                    'new_balance': new_balance
                })
            except ValidationError as e:
                # Улучшенные сообщения об ошибках для пользователя
                error_message = str(e)
                if "Недостатньо коштів" in error_message:
                    error_message = "Вибачте, але на вашому балансі недостатньо коштів для цієї операції"
                elif "Максимальний баланс" in error_message:
                    error_message = "Максимальний баланс перевищено"
                elif "Невірна сума операції" in error_message:
                    error_message = "Невірна сума операції"
                elif "Сума повинна бути більше нуля" in error_message:
                    error_message = "Сума повинна бути більше нуля"
                elif "Мінімальна сума поповнення" in error_message:
                    error_message = "Мінімальна сума поповнення: 100 FanCoins"
                
                return Response(
                    {'error': error_message},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class WithdrawBalanceView(APIView):
    """
    Створення запиту на виплату (PayoutRequest) замість прямого списання.
    Потребує method_id та idempotency_key.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'payout'

    def post(self, request):
        try:
            profile = request.user.profile
        except Exception:
            return Response(
                {'error': 'Профіль користувача не знайдено'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not profile_can_request_balance_withdraw(profile):
            return Response(
                {
                    'error': API_WITHDRAW_ROLE_FORBIDDEN_MESSAGE,
                    'code': API_WITHDRAW_ROLE_FORBIDDEN_CODE,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.payouts.api.serializers import CreatePayoutRequestSerializer
        from apps.payouts.models import PayoutMethod
        from apps.payouts.services.payout_create import create_payout_request
        from apps.payouts.api.serializers import PayoutRequestSerializer

        serializer = CreatePayoutRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            method = PayoutMethod.objects.get(
                id=serializer.validated_data['method_id'],
                profile=request.user.payout_profile,
                is_active=True,
            )
        except PayoutMethod.DoesNotExist:
            return Response(
                {'error': 'Метод виплати не знайдено'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {'error': 'Профіль виплат не налаштовано'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payout_request = create_payout_request(
                user=request.user,
                coins_amount=serializer.validated_data['amount'],
                method=method,
                idempotency_key=serializer.validated_data['idempotency_key'],
            )
        except ValidationError as e:
            error_message = str(e)
            if 'Недостатньо коштів' in error_message:
                error_message = (
                    'Вибачте, але на вашому балансі недостатньо коштів для виведення'
                )
            return Response(
                {'error': error_message},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Неочікувана помилка при виведенні коштів: %s", e, exc_info=True)
            return Response(
                {'error': 'Неочікувана помилка при виведенні коштів'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = PayoutRequestSerializer(payout_request).data
        data['new_balance'] = str(request.user.profile.balance)
        return Response(data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def purchase_chapter(request, chapter_id):
    """Єдиний endpoint покупки глави — делегує ChapterPurchaseService."""
    try:
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Необхідна авторизація для покупки глави'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            request.user.profile
        except Exception:
            return Response(
                {'error': 'Профіль користувача не знайдено'},
                status=status.HTTP_400_BAD_REQUEST
            )
        idempotency_key = (request.data or {}).get('idempotency_key') or ''
        if not idempotency_key or not str(idempotency_key).strip():
            return Response(
                {'error': 'idempotency_key обов\'язковий для захисту від подвійних кліків'},
                status=status.HTTP_400_BAD_REQUEST
            )
        request_id = request.META.get('HTTP_X_REQUEST_ID') or getattr(request, 'request_id', None)
        use_balance = (request.data or {}).get('use_balance') is True

        from apps.subscription.services import (
            ChapterPurchaseService,
            INSUFFICIENT_BALANCE,
            SUBSCRIPTION_EXHAUSTED,
            MULTIPLE_ACTIVE_PREPAID,
        )

        success, data, error_code, error_message = ChapterPurchaseService.purchase_chapter(
            request.user, chapter_id, idempotency_key=idempotency_key, request_id=request_id,
            use_balance=use_balance
        )

        if success:
            return Response(data or {'message': 'Глава придбана', 'is_purchased': True}, status=status.HTTP_200_OK)

        error_messages = {
            INSUFFICIENT_BALANCE: 'Вибачте, але на вашому балансі недостатньо коштів для цієї операції',
            SUBSCRIPTION_EXHAUSTED: 'Пакет підписки вичерпано. Придбайте главу за баланс або новий пакет.',
            MULTIPLE_ACTIVE_PREPAID: 'Помилка: кілька активних пакетів. Зверніться до підтримки.',
        }
        msg = error_messages.get(error_code, error_message or str(error_code))
        return Response({'error': msg, 'code': error_code}, status=status.HTTP_400_BAD_REQUEST)

    except ValidationError as e:
        error_message = str(e)
        if "Недостатньо коштів" in error_message:
            error_message = "Вибачте, але на вашому балансі недостатньо коштів для цієї операції"
        elif "Максимальний баланс" in error_message:
            error_message = "Максимальний баланс перевищено"
        elif "Невірна сума операції" in error_message:
            error_message = "Невірна сума операції"
        elif "Сума повинна бути більше нуля" in error_message:
            error_message = "Сума повинна бути більше нуля"
        elif "Мінімальна сума поповнення" in error_message:
            error_message = "Мінімальна сума поповнення: 100 FanCoins"
        elif "Мінімальна сума виведення" in error_message:
            error_message = "Мінімальна сума виведення: 1,000 FanCoins"
        return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Помилка покупки: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера при покупці глави'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
