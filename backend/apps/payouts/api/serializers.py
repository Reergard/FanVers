import re
from decimal import Decimal

from django.conf import settings
from rest_framework import serializers

from apps.payouts.models import PayoutMethod, PayoutProfile, PayoutRequest

SUPPORTED_CURRENCIES = frozenset([
    "UAH", "EUR", "USD", "GBP", "CZK", "PLN", "HUF",
    "RON", "BGN", "CHF", "SEK", "DKK", "NOK",
])


_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def _reject_formula(value):
    """Відхиляє значення, що починаються із символів CSV/Excel-формул."""
    if isinstance(value, str) and value:
        stripped = value.lstrip()
        if stripped and stripped[0] in _FORMULA_PREFIXES:
            raise serializers.ValidationError(
                "Значення не може починатися з символів = + - @ або пробілів перед ними."
            )
    return value


def _validate_iban_format(value):
    """Перевірка формату IBAN: структура + контрольна сума MOD-97 (ISO 13616)."""
    clean = re.sub(r"\s", "", value).upper()
    if len(clean) < 15 or len(clean) > 34:
        raise serializers.ValidationError(
            "IBAN повинен містити від 15 до 34 символів."
        )
    if not re.match(r"^[A-Z]{2}\d{2}[A-Z0-9]+$", clean):
        raise serializers.ValidationError(
            "IBAN повинен починатися з 2 літер країни та 2 контрольних цифр."
        )
    rearranged = clean[4:] + clean[:4]
    numeric = ""
    for ch in rearranged:
        if ch.isdigit():
            numeric += ch
        else:
            numeric += str(ord(ch) - ord("A") + 10)
    if int(numeric) % 97 != 1:
        raise serializers.ValidationError(
            "IBAN має невірну контрольну суму."
        )


class PayoutProfileSerializer(serializers.ModelSerializer):
    can_request_payout = serializers.BooleanField(read_only=True)

    class Meta:
        model = PayoutProfile
        fields = [
            "id",
            "country",
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

    def validate_country(self, value):
        if not value or len(value) != 2 or not value.isalpha():
            raise serializers.ValidationError(
                "Код країни повинен бути 2 літери (ISO 3166-1 alpha-2), наприклад: UA, DE, CZ"
            )
        return value.upper()

    def validate_full_name_legal(self, value):
        return _reject_formula(value)

    def validate_full_name_latin(self, value):
        return _reject_formula(value)

    def validate_address_line(self, value):
        return _reject_formula(value)

    def validate_city(self, value):
        return _reject_formula(value)

    def validate_postal_code(self, value):
        return _reject_formula(value)


class PayoutMethodSerializer(serializers.ModelSerializer):
    iban_full = serializers.SerializerMethodField()
    bic_swift_display = serializers.SerializerMethodField()

    class Meta:
        model = PayoutMethod
        fields = [
            "id",
            "method_type",
            "iban",
            "iban_full",
            "bic_swift",
            "bic_swift_display",
            "recipient_full_name",
            "currency",
            "is_active",
            "is_default",
        ]
        read_only_fields = ["is_active", "is_default"]
        extra_kwargs = {
            "iban": {"write_only": True, "validators": [_validate_iban_format]},
            "bic_swift": {"write_only": True},
        }

    def get_iban_full(self, obj) -> str:
        iban = (obj.iban or "").strip()
        if iban and not iban.startswith("["):
            return iban
        return ""

    def get_bic_swift_display(self, obj) -> str:
        bic = (obj.bic_swift or "").strip()
        if bic and not bic.startswith("["):
            return bic
        return ""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        iban_full = self.get_iban_full(instance)
        if iban_full:
            visible = max(4, len(iban_full) // 4)
            data["iban_masked"] = iban_full[:visible] + "****" + iban_full[-2:]
        else:
            data["iban_masked"] = "****"
        data["used_in_payouts"] = getattr(instance, "used_in_payouts", False)
        return data

    def validate_recipient_full_name(self, value):
        return _reject_formula(value)

    def validate_currency(self, value):
        if value not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                f"Непідтримувана валюта. Доступні: {', '.join(sorted(SUPPORTED_CURRENCIES))}"
            )
        return value

    def create(self, validated_data):
        profile = validated_data["profile"]
        if PayoutMethod.objects.filter(profile=profile, is_active=True).exists():
            validated_data.setdefault("is_default", False)
        return super().create(validated_data)


class PayoutRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutRequest
        fields = [
            "id",
            "is_urgent",
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
        min_value=settings.PAYOUTS_MIN_AMOUNT_COINS,
        max_value=settings.PAYOUTS_MAX_AMOUNT_COINS,
    )
    method_id = serializers.IntegerField()
    idempotency_key = serializers.CharField(max_length=64)
    is_urgent = serializers.BooleanField(default=False)
