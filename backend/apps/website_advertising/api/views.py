import logging
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import datetime
from .serializers import AdvertisementSerializer
from ..models import Advertisement
from apps.users.models import User
from dateutil import parser
from zoneinfo import ZoneInfo
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.core.smart_throttling import SmartThrottle


logger = logging.getLogger(__name__)

class AdvertisementViewSet(viewsets.ModelViewSet):
    serializer_class = AdvertisementSerializer
    queryset = Advertisement.objects.all()
    
    def get_permissions(self):
        if self.action in ['main_page_ads', 'catalog_page_ads']:
            return []  # Публічний доступ для получения рекламы
        return [IsAuthenticated()]  # Авторизація для інших дій
    
    def get_throttle_scope(self):
        """
        Применяем разные лимиты для разных операций
        Понижаем скоп для подозрительных запросов
        """
        if self.action in ['list', 'retrieve', 'main_page_ads', 'catalog_page_ads']:
            # Чтение рекламы - понижаем при подозрительности
            if SmartThrottle.is_suspicious_request(self.request):
                return 'rating'  # 30/min - мягко режем скорость
            return 'read_light'  # 120/min - обычная скорость
        elif self.action in ['create', 'update', 'partial_update', 'destroy']:
            return 'purchase'  # 10/hour - создание/изменение рекламы
        return None

    def get_queryset(self):
        if self.action in ['list', 'retrieve', 'user_advertisements']:
            logger.info(f"Отримання реклами для користувача: {self.request.user.id}")
            return Advertisement.objects.filter(user=self.request.user)
        return Advertisement.objects.all()

    @action(detail=False, methods=['post'])
    def calculate_cost(self, request):
        logger.info(f"Отримано запит на розрахунок вартості з даними: {request.data}")
        try:
            # Отримуємо поточну дату в UTC
            current_date = timezone.now().date()
            logger.info(f"Поточна дата: {current_date}")

            # Парсимо дати із запиту
            start_date_str = request.data['start_date']
            end_date_str = request.data['end_date']
            
            # Перетворюємо рядки в об'єкти date
            start_date = parser.parse(start_date_str).date()
            end_date = parser.parse(end_date_str).date()
            
            logger.info(f"""
            Порівняння дат:
            Поточна дата: {current_date}
            Дата початку: {start_date}
            Дата закінчення: {end_date}
            """)
            
            # Перевіряємо, що початкова дата не раніше поточної
            if start_date < current_date:
                logger.warning(
                    f"Невірна дата початку: {start_date} раніше поточної дати {current_date}. "
                    f"Початкова дата із запиту: {start_date_str}"
                )
                return Response(
                    {'error': 'Дата початку не може бути раніше поточної дати'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Перевіряємо порядок дат
            if end_date < start_date:
                logger.warning(f"Дата закінчення {end_date} раніше дати початку {start_date}")
                return Response(
                    {'error': 'Дата закінчення не може бути раніше дати початку'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Розрахунок вартості
            cost_per_day = 30
            days = (end_date - start_date).days
            if days == 0:  # Якщо реклама в один день
                days = 1
            total_cost = days * cost_per_day
            
            logger.info(f"""
            Розрахунок вартості:
            Днів між датами: {days}
            Вартість за день: {cost_per_day}
            Загальна вартість: {total_cost}
            """)
            
            return Response({
                'total_cost': total_cost,
                'days': days,
                'cost_per_day': cost_per_day,
                'debug_info': {
                    'current_date': str(current_date),
                    'start_date': str(start_date),
                    'end_date': str(end_date),
                }
            })
            
        except Exception as e:
            logger.error(f"Помилка в calculate_cost: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        logger.info("Початок створення реклами...")
        logger.info(f"Отримані дані: {serializer.validated_data}")
        logger.info(f"Початкові дані: {self.request.data}")
        
        try:
            user = self.request.user
            profile = user.profile
            logger.info(f"Створення реклами для користувача: {user.id}, баланс профілю: {profile.balance}")
            
            start_date = serializer.validated_data['start_date']
            end_date = serializer.validated_data['end_date']
            book = serializer.validated_data['book']
            location = serializer.validated_data['location']
            
            logger.info(f"""
            Деталі реклами:
            - початок: {start_date}
            - кінець: {end_date}
            - книга: {book.id}
            - локація: {location}
            """)
            
            # Розрахунок вартості
            days = (end_date - start_date).days
            if days == 0:
                days = 1
            total_cost = days * 30
            
            logger.info(f"Розрахунок вартості: днів={days}, загальна вартість={total_cost}")
            
            # Перевірка балансу через профіль
            if profile.balance < total_cost:
                logger.warning(f"Недостатньо коштів: баланс={profile.balance}, потрібно={total_cost}")
                raise serializers.ValidationError({
                    'error': 'Недостатньо коштів на балансі',
                    'balance': float(profile.balance),
                    'required': float(total_cost)
                })
            
            with transaction.atomic():
                # Списання коштів через профіль
                profile.update_balance(total_cost, 'advertising')
                
                # Збереження реклами
                ad = serializer.save(
                    user=user,
                    total_cost=total_cost
                )
                
                # Створення запису в журналі реклами
                from apps.monitoring.models import AdvertisingLog
                AdvertisingLog.objects.create(
                    user=user,
                    book=book,
                    location=location,
                    start_date=start_date,
                    end_date=end_date,
                    total_cost=total_cost
                )
                
                # Створення повідомлення
                from apps.notification.models import Notification
                location_names = dict(Advertisement.LOCATION_CHOICES)
                message = f"Увага! Ви замовили рекламу на сторінці '{location_names[location]}' для книги '{book.title}' на період з {start_date} по {end_date} на суму {total_cost} грн!"
                
                Notification.objects.create(
                    user=user,
                    book=book,
                    message=message,
                    is_read=False
                )
                
                logger.info(f"Реклама успішно створена: {ad.id}")
                return ad
            
        except ValidationError as e:
            logger.error(f"Помилка валідації моделі: {str(e)}")
            raise serializers.ValidationError(str(e))
        except serializers.ValidationError as e:
            logger.error(f"Помилка валідації серіалізатора: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Помилка в perform_create: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=['get'])
    def main_page_ads(self, request):
        logger.info("Отримання реклами для головної сторінки...")
        try:
            current_date = timezone.now().date()
            logger.info(f"Поточна дата: {current_date}")
            
            ads = self.queryset.filter(
                start_date__lte=current_date,
                end_date__gte=current_date,
                location='main'
            ).select_related('book')
            
            logger.info(f"Знайдено {ads.count()} активних реклам")
            
            serializer = self.get_serializer(ads, many=True)
            logger.info("Реклама успішно серіалізовано")
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Помилка в main_page_ads: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=['get'])
    def catalog_page_ads(self, request):
        logger.info("Отримання реклами для сторінки каталогу...")
        try:
            current_date = timezone.now().date()
            logger.info(f"Поточна дата: {current_date}")
            
            ads = self.queryset.filter(
                start_date__lte=current_date,
                end_date__gte=current_date,
                location='catalog'
            ).select_related('book')
            
            logger.info(f"Знайдено {ads.count()} активних реклам для каталогу")
            
            serializer = self.get_serializer(ads, many=True)
            logger.info("Реклама для каталогу успішно серіалізовано")
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Помилка в catalog_page_ads: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=['get'])
    def user_advertisements(self, request):
        logger.info(f"Отримання реклами для користувача: {request.user.id}")
        try:
            ads = self.queryset.filter(user=request.user).order_by('-created_at')
            serializer = self.get_serializer(ads, many=True)
            logger.info(f"Знайдено {ads.count()} рекламних оголошень")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Помилка в user_advertisements: {str(e)}", exc_info=True)
            raise
