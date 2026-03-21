from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from ..models import Advertisement
from apps.catalog.api.serializers import BookReaderSerializer
from apps.users.api.serializers import CreateUserSerializer
from .. import services
import logging

logger = logging.getLogger(__name__)


class AdvertisementOrderItemSerializer(serializers.Serializer):
    """Один елемент замовлення реклами."""
    book = serializers.IntegerField()
    location = serializers.ChoiceField(choices=Advertisement.LOCATION_CHOICES)
    target_kind = serializers.ChoiceField(
        choices=Advertisement.TARGET_KIND_CHOICES,
        default="none",
    )
    target_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, data):
        try:
            services.validate_date_order(data["start_date"], data["end_date"])
        except DjangoValidationError as e:
            raise serializers.ValidationError(
                e.messages if hasattr(e, "messages") else str(e)
            )

        loc = data["location"]
        if loc in ("main", "catalog"):
            data["target_kind"] = "none"
            data["target_id"] = None
        tk = data.get("target_kind") or "none"
        tid = data.get("target_id")
        try:
            services.validate_location_target_pair(loc, tk, tid)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages if hasattr(e, "messages") else str(e))
        return data


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
    book_details = BookReaderSerializer(source="book", read_only=True)
    user_details = CreateUserSerializer(source="user", read_only=True)

    class Meta:
        model = Advertisement
        fields = [
            "id",
            "book",
            "book_details",
            "user",
            "user_details",
            "location",
            "target_kind",
            "target_id",
            "start_date",
            "end_date",
            "total_cost",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["total_cost", "is_active", "created_at", "user"]

    def validate(self, data):
        inst = self.instance
        start = data.get("start_date", inst.start_date if inst else None)
        end = data.get("end_date", inst.end_date if inst else None)
        if start is None or end is None:
            return data
        try:
            services.validate_date_order(start, end)
        except DjangoValidationError as e:
            raise serializers.ValidationError(
                e.messages if hasattr(e, "messages") else str(e)
            )

        book = data.get("book", inst.book if inst else None)
        loc = data.get("location", inst.location if inst else None)
        tk = data.get("target_kind", inst.target_kind if inst else "none")
        tid = data.get("target_id", inst.target_id if inst else None)
        if loc in ("main", "catalog"):
            tk = "none"
            tid = None

        try:
            services.validate_location_target_pair(loc, tk, tid)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages if hasattr(e, "messages") else str(e))

        if book is None or loc is None:
            raise serializers.ValidationError(
                "Для перевірки пересічень потрібні коректні книга та місце розміщення"
            )

        exclude_pk = inst.pk if inst else None
        try:
            services.assert_no_overlap(book, loc, tk, tid, start, end, exclude_pk=exclude_pk)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages if hasattr(e, "messages") else str(e))

        return data
