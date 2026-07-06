from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, ROUND_UP
import logging

import stripe
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.users.models import BalanceIdempotencyRecord, Profile

from .models import PaymentSession, WebhookEvent

logger = logging.getLogger(__name__)

stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
stripe.api_version = getattr(settings, "STRIPE_API_VERSION", None)

CZK_UAH_CACHE_KEY = "service_fee:czk_uah_rate"
CZK_UAH_CACHE_TTL = 86400  # 24 hours


def _get_czk_uah_rate() -> Decimal:
    cached = cache.get(CZK_UAH_CACHE_KEY)
    if cached is not None:
        return cached

    try:
        from apps.payouts.services.exchange_rates import fetch_rate
        rate = fetch_rate("CZK", "UAH")
    except Exception:
        logger.warning("Failed to fetch CZK→UAH rate, using fallback", exc_info=True)
        rate = getattr(settings, "SERVICE_FEE_CZK_UAH_FALLBACK", Decimal("1.70"))

    cache.set(CZK_UAH_CACHE_KEY, rate, CZK_UAH_CACHE_TTL)
    return rate


@dataclass(frozen=True)
class ServiceFeeResult:
    amount_coins: Decimal
    fee_percent: Decimal
    fee_fixed_czk: Decimal
    fee_fixed_uah: Decimal
    fee_total_uah: Decimal
    amount_charged_uah: Decimal
    czk_uah_rate: Decimal


def calculate_service_fee(amount_coins: Decimal) -> ServiceFeeResult:
    fee_percent = getattr(settings, "SERVICE_FEE_PERCENT", Decimal("5"))
    fee_fixed_czk = getattr(settings, "SERVICE_FEE_FIXED_CZK", Decimal("8"))
    rate = _get_czk_uah_rate()

    fee_fixed_uah = (fee_fixed_czk * rate).quantize(Decimal("0.01"), rounding=ROUND_UP)
    fee_from_percent = (amount_coins * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_UP)
    fee_total = fee_from_percent + fee_fixed_uah
    amount_charged = amount_coins + fee_total

    return ServiceFeeResult(
        amount_coins=amount_coins,
        fee_percent=fee_percent,
        fee_fixed_czk=fee_fixed_czk,
        fee_fixed_uah=fee_fixed_uah,
        fee_total_uah=fee_total,
        amount_charged_uah=amount_charged,
        czk_uah_rate=rate,
    )


@dataclass(frozen=True)
class CheckoutSessionResult:
    checkout_url: str
    stripe_session_id: str
    payment_session_id: str


def _validate_amount(amount_coins: Decimal) -> None:
    if amount_coins is None:
        raise ValueError("amount is required")
    if amount_coins <= 0:
        raise ValueError("amount must be > 0")

    # Ensure at most 2 decimals (Decimal from DRF serializer should already enforce it)
    quant = amount_coins.quantize(Decimal("0.01"))
    if quant != amount_coins:
        raise ValueError("amount must have at most 2 decimal places")

    min_dep = Decimal(str(Profile.MIN_DEPOSIT_AMOUNT))
    if amount_coins < min_dep:
        raise ValueError(f"min deposit is {Profile.MIN_DEPOSIT_AMOUNT}")

    max_dep = Decimal(str(Profile.MAX_DEPOSIT_AMOUNT))
    if amount_coins > max_dep:
        raise ValueError(f"max deposit amount is {max_dep}")


def _validate_balance_limit(profile: Profile, amount_coins: Decimal) -> None:
    if profile.balance + amount_coins > Profile.MAX_BALANCE:
        raise ValueError("max balance exceeded")


def create_checkout_session(*, user, amount_coins: Decimal, request_meta: dict | None = None) -> CheckoutSessionResult:
    _validate_amount(amount_coins)

    fee = calculate_service_fee(amount_coins)
    amount_charged_kopecks = int(fee.amount_charged_uah * 100)

    expires_at_dt = timezone.now() + timedelta(minutes=30)
    expires_at_unix = int(time.time()) + 1800

    metadata = {
        "user_id": str(user.id),
        "amount_coins": str(amount_coins),
        "service_fee_uah": str(fee.fee_total_uah),
    }

    if request_meta:
        ip = request_meta.get("ip")
        ua = request_meta.get("user_agent")
        if ip:
            metadata["ip"] = str(ip)
        if ua:
            metadata["user_agent"] = str(ua)[:500]

    with transaction.atomic():
        # Lock profile row to validate against concurrent balance changes.
        profile = Profile.objects.select_for_update().get(user_id=user.id)
        _validate_balance_limit(profile, amount_coins)

        payment_session = PaymentSession.objects.create(
            user=user,
            stripe_session_id=None,  # set after Stripe call
            amount_coins=amount_coins,
            amount_kopecks=amount_charged_kopecks,
            service_fee_uah=fee.fee_total_uah,
            currency="uah",
            status=PaymentSession.STATUS_PENDING,
            expires_at=expires_at_dt,
            metadata=metadata,
        )

    # Stripe call is outside DB transaction: avoids holding locks on slow network.
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        currency="uah",
        line_items=[
            {
                "price_data": {
                    "currency": "uah",
                    "unit_amount": amount_charged_kopecks,
                    "product_data": {
                        "name": f"{int(amount_coins)} FanCoins",
                        "description": "Поповнення балансу FanVers",
                    },
                },
                "quantity": 1,
            }
        ],
        client_reference_id=str(user.id),
        customer_email=getattr(user, "email", None) or None,
        metadata={
            **metadata,
            "payment_session_id": str(payment_session.id),
        },
        success_url=str(settings.STRIPE_SUCCESS_URL).rstrip("/") + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=str(settings.STRIPE_CANCEL_URL),
        expires_at=expires_at_unix,
    )

    stripe_session_id = session.get("id")
    checkout_url = session.get("url")
    if not stripe_session_id or not checkout_url:
        raise RuntimeError("Stripe did not return checkout session id/url")

    PaymentSession.objects.filter(id=payment_session.id).update(stripe_session_id=stripe_session_id)

    return CheckoutSessionResult(
        checkout_url=str(checkout_url),
        stripe_session_id=str(stripe_session_id),
        payment_session_id=str(payment_session.id),
    )


def handle_checkout_session_completed(*, event: dict) -> None:
    data_obj = (event or {}).get("data", {}).get("object", {}) or {}
    stripe_session_id = data_obj.get("id")
    payment_status = data_obj.get("payment_status")
    payment_intent_id = data_obj.get("payment_intent")
    stripe_event_id = (event or {}).get("id") or ""

    if not stripe_session_id:
        return
    if not stripe_event_id:
        return
    if payment_status != "paid":
        return

    try:
        payment_session = PaymentSession.objects.select_related("user").get(stripe_session_id=stripe_session_id)
    except PaymentSession.DoesNotExist:
        logger.warning("Stripe session not found in DB: %s", stripe_session_id)
        return

    if payment_session.status != PaymentSession.STATUS_PENDING:
        return

    user = payment_session.user

    with transaction.atomic():
        # 1) Deduplicate Stripe event (savepoint-safe for Postgres)
        try:
            with transaction.atomic():
                WebhookEvent.objects.create(
                    stripe_event_id=stripe_event_id,
                    event_type=str(event.get("type", "")),
                    payload=event,
                )
        except IntegrityError:
            return

        # 2) Deduplicate balance apply (idempotency record) (savepoint-safe)
        try:
            with transaction.atomic():
                BalanceIdempotencyRecord.objects.create(
                    user=user,
                    key=str(payment_session.id),
                    operation_type=BalanceIdempotencyRecord.OP_DEPOSIT,
                )
        except IntegrityError:
            # Balance already applied; still mark session paid if it isn't.
            PaymentSession.objects.filter(id=payment_session.id, status=PaymentSession.STATUS_PENDING).update(
                status=PaymentSession.STATUS_PAID,
                paid_at=timezone.now(),
                stripe_payment_intent_id=payment_intent_id or None,
            )
            return

        # 3) Apply balance (includes select_for_update)
        profile = Profile.objects.get(user_id=user.id)
        profile.balance_operation(payment_session.amount_coins, "deposit")

        # 4) Mark session paid
        PaymentSession.objects.filter(id=payment_session.id, status=PaymentSession.STATUS_PENDING).update(
            status=PaymentSession.STATUS_PAID,
            paid_at=timezone.now(),
            stripe_payment_intent_id=payment_intent_id or None,
        )


def handle_checkout_session_expired(*, event: dict) -> None:
    data_obj = (event or {}).get("data", {}).get("object", {}) or {}
    stripe_session_id = data_obj.get("id")
    if not stripe_session_id:
        return
    PaymentSession.objects.filter(
        stripe_session_id=stripe_session_id,
        status=PaymentSession.STATUS_PENDING,
    ).update(status=PaymentSession.STATUS_EXPIRED)

