from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import (
    UpdateBalanceSerializer, 
    BalanceOperationSerializer
)
from .mixins import BalanceOperationMixin
# Удаляем импорт старых throttling классов
from apps.catalog.models import Chapter
from apps.monitoring.models import TransactionLog
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
    try:
        # Дополнительная проверка авторизации
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Необхідна авторизація для покупки глави'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        chapter = get_object_or_404(Chapter, id=chapter_id)
        
        # Проверяем существование профиля покупателя
        try:
            buyer_profile = request.user.profile
        except Exception:
            return Response(
                {'error': 'Профіль користувача не знайдено'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Проверяем существование профиля владельца книги
        try:
            owner_profile = chapter.book.owner.profile
        except Exception:
            return Response(
                {'error': 'Профіль власника книги не знайдено'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем, что пользователь не пытается купить свою собственную главу
        if chapter.book.owner == request.user:
            return Response(
                {'error': 'Ви не можете купити власну главу'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем, что глава уже не куплена
        if buyer_profile.purchased_chapters.filter(id=chapter_id).exists():
            return Response(
                {'message': 'Глава вже придбана', 'is_purchased': True}, 
                status=status.HTTP_200_OK
            )

        # Проверяем, что глава платная
        if not chapter.is_paid or chapter.price <= 0:
            return Response(
                {'error': 'Ця глава безкоштовна'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        chapter_price = chapter.price
        
        # Проверяем достаточность средств
        if buyer_profile.balance < chapter_price:
            return Response(
                {'error': f'Недостатньо коштів. Потрібно: {chapter_price} FanCoins, доступно: {buyer_profile.balance} FanCoins'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        commission_amount = owner_profile.calculate_commission_amount(chapter_price)
        owner_amount = chapter_price - commission_amount

        balance_mixin = BalanceOperationMixin()
        
        with transaction.atomic():
            # Списуємо з покупця
            buyer_result = balance_mixin.perform_balance_operation(
                buyer_profile,
                chapter_price,
                'purchase'
            )
            
            # Нараховуємо власнику
            owner_result = balance_mixin.perform_balance_operation(
                owner_profile,
                owner_amount,
                'earning'
            )
            
            # Записуємо інформацію про транзакцію
            TransactionLog.objects.create(
                buyer=buyer_profile,
                owner=owner_profile,
                chapter=chapter,
                book=chapter.book,
                original_price=chapter_price,
                commission_percent=owner_profile.commission,
                commission_amount=commission_amount,
                final_amount=owner_amount
            )
            
            # Добавляем главу к купленным
            buyer_profile.purchased_chapters.add(chapter)
            
            # Обновляем прогресс чтения
            from apps.monitoring.models import UserChapterProgress
            progress, created = UserChapterProgress.objects.get_or_create(
                user=request.user,
                chapter=chapter,
                defaults={'is_purchased': True}
            )
            if not created:
                progress.is_purchased = True
                progress.save()

        return Response({
            'message': 'Глава успішно придбана',
            'new_balance': float(buyer_result),
            'chapter_id': chapter_id,
            'is_purchased': True,
            'chapter_title': chapter.title,
            'price_paid': float(chapter_price)
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
        elif "Мінімальна сума виведення" in error_message:
            error_message = "Мінімальна сума виведення: 1,000 FanCoins"
        
        return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Помилка покупки: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Внутрішня помилка сервера при покупці глави'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 