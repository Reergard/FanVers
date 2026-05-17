from decimal import Decimal

from rest_framework import serializers

from apps.payouts.models import PayoutMethod, PayoutProfile, PayoutRequest


class PayoutProfileSerializer(serializers.ModelSerializer):
    can_request_payout = serializers.BooleanField(read_only=True)

    class Meta:
        model = PayoutProfile
        fields = [
            "id",
            "legal_status",
            "country",
            "tax_residency_country",
            "tax_id",
            "full_name_legal",
            "full_name_latin",
            "address_line",
            "city",
            "postal_code",
            "verification_status",
            "payout_approved",
            "can_request_payout",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "verification_status",
            "payout_approved",
            "created_at",
            "updated_at",
        ]


class PayoutMethodSerializer(serializers.ModelSerializer):
    is_iban_cooldown_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = PayoutMethod
        fields = [
            "id",
            "method_type",
            "iban",
            "bic_swift",
            "recipient_full_name",
            "currency",
            "is_active",
            "is_default",
            "is_iban_cooldown_active",
        ]
        extra_kwargs = {
            "iban": {"write_only": True},
            "bic_swift": {"write_only": True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        iban = instance.iban
        if iban and len(iban) > 8:
            data["iban_masked"] = iban[:4] + "****" + iban[-4:]
        else:
            data["iban_masked"] = "****"
        return data

    def create(self, validated_data):
        profile = validated_data["profile"]
        iban = validated_data.get("iban", "")
        if PayoutMethod.objects.filter(profile=profile, is_active=True).exists():
            validated_data.setdefault("is_default", False)
        method = super().create(validated_data)
        if iban:
            method.iban_changed_at = method.created_at
            method.save(update_fields=["iban_changed_at"])
        return method

    def update(self, instance, validated_data):
        new_iban = validated_data.get("iban")
        if new_iban and new_iban != instance.iban:
            from django.utils import timezone

            validated_data["iban_changed_at"] = timezone.now()
        return super().update(instance, validated_data)


class PayoutRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutRequest
        fields = [
            "id",
            "coins_amount",
            "commission_percent",
            "commission_coins",
            "coins_after_commission",
            "payout_currency",
            "exchange_rate",
            "amount_gross",
            "amount_net",
            "status",
            "created_at",
            "deadline_at",
            "completed_at",
            "invoice_number",
        ]
        read_only_fields = fields


class CreatePayoutRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1"),
    )
    method_id = serializers.IntegerField()
    idempotency_key = serializers.CharField(max_length=64)
