from rest_framework import serializers
from decimal import Decimal

from ..models import (
    BookSubscriptionSettings,
    BookSubscriptionPlan,
    UserBookSubscription,
)
from ..services import SubscriptionSettingsService, _calculate_plan_price
from apps.catalog.models import Book

MAX_ACTIVE_PLANS = 2


class BookSubscriptionPlanSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    price_preview = serializers.SerializerMethodField()

    class Meta:
        model = BookSubscriptionPlan
        fields = [
            'id', 'discount_percent', 'discount_threshold', 'purchase_mode',
            'price_preview', 'is_active', 'sort_order'
        ]

    def get_price_preview(self, plan):
        """Розрахована ціна для відображення (з перших N платних глав)."""
        book = plan.settings.book if plan.settings_id else None
        if not book:
            return None
        price = _calculate_plan_price(plan, book)
        return str(price) if price is not None else None


class BookSubscriptionSettingsSerializer(serializers.ModelSerializer):
    plans = serializers.SerializerMethodField()
    book_slug = serializers.SlugField(source='book.slug', read_only=True)

    class Meta:
        model = BookSubscriptionSettings
        fields = [
            'id', 'book', 'book_slug', 'is_enabled',
            'plans', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_plans(self, obj):
        """Тільки активні плани — щоб «видалені» не зʼявлялись знову в формі."""
        active = obj.plans.filter(is_active=True).order_by('sort_order', 'discount_threshold', 'id')
        return BookSubscriptionPlanSerializer(active, many=True).data


class BookSubscriptionPlanUpdateSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal('0'))
    discount_threshold = serializers.IntegerField(min_value=1)
    purchase_mode = serializers.ChoiceField(
        choices=[c[0] for c in BookSubscriptionPlan.PURCHASE_MODE_CHOICES],
        default=BookSubscriptionPlan.PURCHASE_MODE_PREPAID,
    )
    is_active = serializers.BooleanField(default=True)
    sort_order = serializers.IntegerField(min_value=0, default=0)

    def validate(self, attrs):
        discount_percent = attrs.get('discount_percent')
        discount_threshold = attrs.get('discount_threshold', 1)
        purchase_mode = attrs.get('purchase_mode', 'prepaid')

        if discount_percent is not None and discount_percent <= 0:
            raise serializers.ValidationError({
                'discount_percent': 'План без знижки не має сенсу. Вкажіть знижку > 0%.'
            })
        if discount_threshold < 1:
            raise serializers.ValidationError({
                'discount_threshold': 'Поріг має бути не менше 1 для обох режимів.'
            })
        return attrs


class BookSubscriptionSettingsUpdateSerializer(serializers.ModelSerializer):
    plans = BookSubscriptionPlanUpdateSerializer(many=True, required=False)

    class Meta:
        model = BookSubscriptionSettings
        fields = ['is_enabled', 'plans']

    def validate(self, attrs):
        is_enabled = attrs.get('is_enabled')
        if is_enabled is None and self.instance:
            is_enabled = self.instance.is_enabled
        elif is_enabled is None:
            is_enabled = False

        plans = attrs.get('plans')
        if plans is not None:
            active = [p for p in plans if p.get('is_active', True)]
            if is_enabled and not active:
                raise serializers.ValidationError({
                    'plans': 'При увімкненій підписці потрібен щонайменше один активний план.'
                })
        elif is_enabled and self.instance:
            if not self.instance.plans.filter(is_active=True).exists():
                raise serializers.ValidationError({
                    'plans': 'При увімкненій підписці потрібен щонайменше один активний план.'
                })
        return attrs

    def validate_plans(self, value):
        if not value:
            return value
        # Дублікати перевіряємо тільки серед активних
        seen = set()
        for p in value:
            if not p.get('is_active', True):
                continue
            key = (Decimal(str(p.get('discount_percent') or 0)), int(p.get('discount_threshold') or 0), str(p.get('purchase_mode') or 'prepaid'))
            if key in seen:
                raise serializers.ValidationError(
                    'Дублікат активного плану з такими параметрами'
                )
            seen.add(key)
        active_count = sum(1 for p in value if p.get('is_active', True))
        if active_count > MAX_ACTIVE_PLANS:
            raise serializers.ValidationError(
                f'Максимум {MAX_ACTIVE_PLANS} активних планів'
            )
        return value

    def update(self, instance, validated_data):
        return SubscriptionSettingsService.update_settings(instance, validated_data)


class UserBookSubscriptionSerializer(serializers.ModelSerializer):
    # Snapshot-поля: purchased_chapters_count, price_paid — історичний стан на момент покупки
    plan_chapters_count = serializers.IntegerField(
        source='purchased_chapters_count',
        read_only=True,
        help_text='Snapshot: кількість розділів на момент покупки'
    )
    plan_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source='price_paid',
        read_only=True,
        help_text='Snapshot: ціна на момент покупки'
    )
    book_slug = serializers.SlugField(source='book.slug', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)

    class Meta:
        model = UserBookSubscription
        fields = [
            'id', 'book', 'book_slug', 'book_title', 'plan',
            'plan_chapters_count', 'plan_price',
            'purchased_chapters_count', 'remaining_chapters_count',
            'price_paid', 'status', 'purchase_mode',
            'created_at', 'expires_at'
        ]
        read_only_fields = fields


class PurchasePlanSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    idempotency_key = serializers.CharField(required=True, allow_blank=False)


class ApplyPlanSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    chapter_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    idempotency_key = serializers.CharField(required=True, allow_blank=False)
