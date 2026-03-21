from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import (
    UpdateBalanceSerializer,
    BalanceOperationSerializer
)
from .mixins import BalanceOperationMixin
import logging

logger = logging.getLogger(__name__)

class AddBalanceView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_scope = 'balance'  # Операции с балансом

    def post(self, request):
        serializer = UpdateBalanceSerializer(data=request.data)
        if serializer.is_valid():
            try:
                amount = serializer.validated_data['amount']
                balance_mixin = BalanceOperationMixin()
                new_balance = balance_mixin.perform_balance_operation(
                    request.user.profile,
                    amount,
                    'deposit'
                )
                return Response({
                    'message': 'Баланс успішно поповнено',
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def withdraw_balance(request):
    try:
        amount = float(request.data.get('amount', 0))
        
        logger.info(f"Запит на виведення коштів: {request.data}")
        logger.info(f"Сума після конвертації: {amount}")
        
        serializer = BalanceOperationSerializer(
            data={
                'amount': amount,
                'operation_type': 'withdraw'
            },
            context={'request': request}
        )
        
        if serializer.is_valid():
            try:
                amount = serializer.validated_data['amount']
                balance_mixin = BalanceOperationMixin()
                new_balance = balance_mixin.perform_balance_operation(
                    request.user.profile,
                    amount,
                    'withdraw'
                )
                return Response({
                    'message': 'Кошти успішно виведені',
                    'new_balance': new_balance
                })
            except ValidationError as e:
                logger.error(f"Помилка валідації: {str(e)}")
                # Улучшенные сообщения об ошибках для пользователя
                error_message = str(e)
                if "Недостатньо коштів" in error_message:
                    error_message = "Вибачте, але на вашому балансі недостатньо коштів для виведення"
                elif "Максимальний баланс" in error_message:
                    error_message = "Максимальний баланс перевищено"
                elif "Невірна сума операції" in error_message:
                    error_message = "Невірна сума операції"
                elif "Сума повинна бути більше нуля" in error_message:
                    error_message = "Сума повинна бути більше нуля"
                elif "Мінімальна сума виведення" in error_message:
                    error_message = "Мінімальна сума виведення: 1,000 FanCoins"
                
                return Response(
                    {'error': error_message},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            logger.error(f"Помилки серіалізатора: {serializer.errors}")
            return Response(
                {'error': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Неочікувана помилка: {str(e)}")
        return Response(
            {'error': 'Неочікувана помилка при виведенні коштів'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_balance(request):
    serializer = UpdateBalanceSerializer(data=request.data)
    if serializer.is_valid():
        try:
            amount = serializer.validated_data['amount']
            balance_mixin = BalanceOperationMixin()
            new_balance = balance_mixin.perform_balance_operation(
                request.user.profile,
                amount,
                'deposit'
            )
            return Response({
                'message': 'Баланс успішно оновлено',
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