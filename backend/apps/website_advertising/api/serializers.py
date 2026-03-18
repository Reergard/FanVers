from rest_framework import serializers
from ..models import Advertisement
from apps.catalog.api.serializers import BookReaderSerializer
from apps.users.api.serializers import CreateUserSerializer
import logging

logger = logging.getLogger(__name__)


class AdvertisementOrderItemSerializer(serializers.Serializer):
    """Один елемент замовлення реклами."""
    book = serializers.IntegerField()
    location = serializers.ChoiceField(choices=Advertisement.LOCATION_CHOICES)
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class AdvertisementOrderSerializer(serializers.Serializer):
    """Заказ реклами — масив позицій для атомарного створення."""
    items = AdvertisementOrderItemSerializer(many=True)

    def validate(self, data):
        items = data["items"]
        if not items:
            raise serializers.ValidationError("Потрібно хоча б одне розміщення")

        book_ids = {item["book"] for item in items}
        if len(book_ids) != 1:
            raise serializers.ValidationError(
                "Усі позиції замовлення мають бути для однієї книги"
            )
        return data


class AdvertisementSerializer(serializers.ModelSerializer):
    book_details = BookReaderSerializer(source='book', read_only=True)
    user_details = CreateUserSerializer(source='user', read_only=True)
    
    class Meta:
        model = Advertisement
        fields = [
            'id', 
            'book',
            'book_details',
            'user',
            'user_details',
            'location', 
            'start_date',
            'end_date',
            'total_cost',
            'is_active',
            'created_at'
        ]
        read_only_fields = ['total_cost', 'is_active', 'created_at', 'user']

    def validate(self, data):
        """
        Проверка валидности дат и других условий
        """
        logger.info(f"Валідація даних в сериалізаторі: {data}")
        
        if data['start_date'] > data['end_date']:
            logger.warning(f"Помилка валідації: дата початку {data['start_date']} пізніше дати закінчення {data['end_date']}")
            raise serializers.ValidationError(
                'Дата початку не може бути пізніше дати закінчення'
            )
        
        # Проверка на пересечение дат для конкретной книги
        overlapping_ads = Advertisement.objects.filter(
            book=data['book'],
            location=data['location'],
            start_date__lte=data['end_date'],
            end_date__gte=data['start_date'],
            is_active=True
        )
        
        if self.instance:
            overlapping_ads = overlapping_ads.exclude(pk=self.instance.pk)
            
        if overlapping_ads.exists():
            logger.warning(f"Знайдено пересічні реклами для книги {data['book'].title}: {overlapping_ads.count()}")
            raise serializers.ValidationError(
                f'Для книги "{data["book"].title}" вже є активна реклама на вибрані дати'
            )
            
        return data
