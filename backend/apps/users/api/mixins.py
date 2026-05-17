from django.db import transaction
from django.core.exceptions import ValidationError
from apps.users.models import Profile, BalanceLog
from django.conf import settings
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

class BalanceOperationMixin:
    MIN_DEPOSIT_AMOUNT = 100
    MIN_WITHDRAW_AMOUNT = 1000

    @transaction.atomic
    def perform_balance_operation(self, profile, amount, operation_type):
        try:
            # Валидация входных данных
            if not isinstance(amount, (int, float, Decimal)):
                raise ValidationError('Невірна сума операції')
            
            if amount <= 0:
                raise ValidationError('Сума повинна бути більше нуля')
            
            # Проверка на разумные пределы (защита от переполнения)
            if amount > 1000000:  # Максимум 1 млн за операцию
                raise ValidationError('Сума операції занадто велика')
            
            # Проверка на разумную точность (максимум 2 знака после запятой)
            if isinstance(amount, float):
                # Округляем до 2 знаков после запятой для корректной обработки
                amount = round(amount, 2)
            
            if operation_type == 'deposit' and amount < self.MIN_DEPOSIT_AMOUNT:
                raise ValidationError(f'Мінімальна сума поповнення: {self.MIN_DEPOSIT_AMOUNT} грн')
            
            if operation_type == 'withdraw' and amount < self.MIN_WITHDRAW_AMOUNT:
                raise ValidationError(f'Мінімальна сума виведення: {self.MIN_WITHDRAW_AMOUNT} грн')

            # Блокируем профиль для предотвращения race conditions
            profile = Profile.objects.select_for_update().get(id=profile.id)
            
            # Дополнительная проверка на существование профиля
            if not profile:
                raise ValidationError('Профіль користувача не знайдено')
            
            # Проверяем баланс перед операциями списания
            if operation_type in ['withdraw', 'purchase', 'thanks_given']:
                if profile.balance < amount:
                    raise ValidationError(f'Недостатньо коштів. Доступно: {profile.balance} FanCoins, потрібно: {amount} FanCoins')
                
                # Дополнительная проверка на отрицательный баланс после операции
                new_balance = profile.balance - amount
                if new_balance < 0:
                    raise ValidationError(f'Недостатньо коштів. Доступно: {profile.balance} FanCoins, потрібно: {amount} FanCoins')
                
                profile.balance = new_balance
                
            elif operation_type in ['deposit', 'earning', 'thanks_received', 'refund']:
                # Проверяем максимальный баланс
                new_balance = profile.balance + amount
                if new_balance > 1000000:  # Максимум 1 млн
                    raise ValidationError('Максимальний баланс: 1,000,000 FanCoins')
                
                profile.balance = new_balance
            else:
                raise ValidationError(f'Невідомий тип операції: {operation_type}')
            
            # Сохраняем изменения
            profile.save(update_fields=['balance'])
            
            # Логіруємо операцію з балансом
            if operation_type in ['deposit', 'withdraw']:
                from apps.monitoring.models import BalanceOperationLog
                BalanceOperationLog.objects.create(
                    profile=profile,
                    amount=amount,
                    operation_type=operation_type,
                    status='completed'
                )

            return profile.balance

        except ValidationError:
            # Перебрасываем ValidationError без изменений
            raise
        except Exception as e:
            logger.error(f"Error in balance operation: {str(e)}", exc_info=True)
            
            # Логируем неудачную операцию
            if operation_type in ['deposit', 'withdraw']:
                try:
                    from apps.monitoring.models import BalanceOperationLog
                    BalanceOperationLog.objects.create(
                        profile=profile,
                        amount=amount,
                        operation_type=operation_type,
                        status='failed'
                    )
                except Exception as log_error:
                    logger.error(f"Error logging failed operation: {str(log_error)}")
            
            raise ValidationError('Помилка при виконанні операції з балансом')