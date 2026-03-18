import logging
from decimal import Decimal
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from dateutil import parser

from .serializers import AdvertisementSerializer, AdvertisementOrderSerializer
from ..models import Advertisement
from ..services import calc_total_cost, calc_days_inclusive, PRICE_PER_DAY
from apps.catalog.models import Book
from apps.core.smart_throttling import SmartThrottle

logger = logging.getLogger(__name__)

class AdvertisementViewSet(viewsets.ModelViewSet):
    serializer_class = AdvertisementSerializer
    queryset = Advertisement.objects.all()
    
    def get_permissions(self):
        if self.action in ['main_page_ads', 'catalog_page_ads']:
            return []  # Публічний доступ для отримання реклами
        return [IsAuthenticated()]  # Авторизація для інших дій
    
    def get_throttle_scope(self):
        if self.action in ['list', 'retrieve', 'main_page_ads', 'catalog_page_ads', 'book_advertisements']:
            if SmartThrottle.is_suspicious_request(self.request):
                return 'rating'
            return 'read_light'
        elif self.action in ['create', 'update', 'partial_update', 'destroy', 'submit_order']:
            return 'purchase'
        return None

    def get_queryset(self):
        if self.action in ['list', 'retrieve', 'user_advertisements']:
            logger.info(f"Отримання реклами для користувача: {self.request.user.id}")
            return Advertisement.objects.filter(user=self.request.user)
        return Advertisement.objects.all()

    @action(detail=False, methods=['post'])
    def calculate_cost(self, request):
        try:
            current_date = timezone.now().date()
            start_date_str = request.data.get('start_date')
            end_date_str = request.data.get('end_date')
            location = request.data.get('location', 'main')

            if not start_date_str or not end_date_str:
                return Response(
                    {'error': 'Потрібні start_date та end_date'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            start_date = parser.parse(start_date_str).date()
            end_date = parser.parse(end_date_str).date()

            if start_date < current_date:
                return Response(
                    {'error': 'Дата початку не може бути раніше поточної дати'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if end_date < start_date:
                return Response(
                    {'error': 'Дата закінчення не може бути раніше дати початку'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_cost = calc_total_cost(location, start_date, end_date)
            days = calc_days_inclusive(start_date, end_date)
            cost_per_day = PRICE_PER_DAY.get(location, PRICE_PER_DAY['main'])

            return Response({
                'total_cost': float(total_cost),
                'days': days,
                'cost_per_day': float(cost_per_day),
            })
        except Exception as e:
            logger.error(f"Помилка в calculate_cost: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        try:
            user = self.request.user
            profile = user.profile
            start_date = serializer.validated_data['start_date']
            end_date = serializer.validated_data['end_date']
            book = serializer.validated_data['book']
            location = serializer.validated_data['location']

            if book.owner_id != user.id:
                raise serializers.ValidationError(
                    "У вас немає прав для реклами цієї книги"
                )

            total_cost = calc_total_cost(location, start_date, end_date)

            if profile.balance < total_cost:
                raise serializers.ValidationError({
                    'error': 'Недостатньо коштів на балансі',
                    'balance': float(profile.balance),
                    'required': float(total_cost)
                })

            with transaction.atomic():
                profile.update_balance(total_cost, 'advertising')
                ad = serializer.save(user=user, total_cost=total_cost)

                from apps.monitoring.models import AdvertisingLog
                AdvertisingLog.objects.create(
                    user=user,
                    book=book,
                    location=location,
                    start_date=start_date,
                    end_date=end_date,
                    total_cost=total_cost
                )

                from apps.notification.models import Notification
                location_names = dict(Advertisement.LOCATION_CHOICES)
                message = (
                    f"Увага! Ви замовили рекламу на сторінці "
                    f"'{location_names.get(location, location)}' для книги "
                    f"'{book.title}' на період з {start_date} по {end_date} "
                    f"на суму {total_cost} FanCoins!"
                )
                Notification.objects.create(
                    user=user,
                    book=book,
                    message=message,
                    is_read=False
                )
                return ad

        except ValidationError as e:
            raise serializers.ValidationError(str(e))
        except serializers.ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка в perform_create: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=['post'])
    def submit_order(self, request):
        """Атомарне створення всього замовлення реклами."""
        serializer = AdvertisementOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data["items"]
        user = request.user
        profile = user.profile
        current_date = timezone.now().date()
        book_id = items[0]["book"]

        from apps.monitoring.models import AdvertisingLog
        from apps.notification.models import Notification

        with transaction.atomic():
            try:
                book = Book.objects.select_for_update().get(pk=book_id)
            except Book.DoesNotExist:
                raise serializers.ValidationError("Книгу не знайдено")

            if book.owner_id != user.id:
                raise serializers.ValidationError(
                    "У вас немає прав для реклами цієї книги"
                )

            profile = type(profile).objects.select_for_update().get(pk=profile.pk)

            total_order_cost = Decimal("0.00")
            prepared_items = []

            for item in items:
                start_date = item["start_date"]
                end_date = item["end_date"]
                location = item["location"]

                if start_date > end_date:
                    raise serializers.ValidationError(
                        "Дата початку не може бути пізніше дати закінчення"
                    )
                if start_date < current_date:
                    raise serializers.ValidationError(
                        "Дата початку не може бути раніше поточної дати"
                    )

                overlapping = Advertisement.objects.filter(
                    book=book,
                    location=location,
                    start_date__lte=end_date,
                    end_date__gte=start_date,
                    is_active=True,
                )
                if overlapping.exists():
                    location_names = dict(Advertisement.LOCATION_CHOICES)
                    loc_name = location_names.get(location, location)
                    raise serializers.ValidationError(
                        f'Для книги "{book.title}" вже є активна реклама '
                        f'на вибрані дати для "{loc_name}"'
                    )

                item_cost = calc_total_cost(location, start_date, end_date)
                total_order_cost += item_cost
                prepared_items.append({
                    "book": book,
                    "location": location,
                    "start_date": start_date,
                    "end_date": end_date,
                    "total_cost": item_cost,
                })

            if profile.balance < total_order_cost:
                raise serializers.ValidationError({
                    "error": "Недостатньо коштів на балансі",
                    "balance": float(profile.balance),
                    "required": float(total_order_cost),
                })

            profile.update_balance(total_order_cost, "advertising")

            created_ads = []
            for item in prepared_items:
                ad = Advertisement.objects.create(
                    user=user,
                    book=item["book"],
                    location=item["location"],
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    total_cost=item["total_cost"],
                    is_active=True,
                )
                created_ads.append(ad)

                AdvertisingLog.objects.create(
                    user=user,
                    book=item["book"],
                    location=item["location"],
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    total_cost=item["total_cost"],
                )

                location_names = dict(Advertisement.LOCATION_CHOICES)
                loc_name = location_names.get(item["location"], item["location"])
                message = (
                    f"Увага! Ви замовили рекламу на сторінці '{loc_name}' "
                    f"для книги '{item['book'].title}' на період з "
                    f"{item['start_date']} по {item['end_date']} "
                    f"на суму {item['total_cost']} FanCoins!"
                )
                Notification.objects.create(
                    user=user,
                    book=item["book"],
                    message=message,
                    is_read=False
                )

            result = AdvertisementSerializer(created_ads, many=True)
            return Response(result.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def book_advertisements(self, request):
        """Реклама книги (фільтр по book_id у query params)."""
        book_id = request.query_params.get("book")
        qs = Advertisement.objects.filter(user=request.user)

        if book_id:
            try:
                qs = qs.filter(book_id=int(book_id))
            except (ValueError, TypeError):
                pass

        qs = qs.select_related('book').order_by('-created_at')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def main_page_ads(self, request):
        logger.info("Отримання реклами для головної сторінки...")
        try:
            current_date = timezone.now().date()
            logger.info(f"Поточна дата: {current_date}")
            
            ads = self.queryset.filter(
                start_date__lte=current_date,
                end_date__gte=current_date,
                location='main',
                is_active=True,
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
                location='catalog',
                is_active=True,
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
