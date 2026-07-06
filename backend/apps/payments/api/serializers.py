from decimal import Decimal

from rest_framework import serializers


class CreateCheckoutSessionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("100"),
        max_value=Decimal("100000"),
    )


class FeePreviewQuerySerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("100"),
        max_value=Decimal("100000"),
    )


class SessionStatusQuerySerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=128, required=True, allow_blank=False, trim_whitespace=True)

