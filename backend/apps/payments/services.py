from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
import logging

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.users.api.mixins import BalanceOperationMixin
from apps.users.models import BalanceIdempotencyRecord, Profile

from .models import PaymentSession, WebhookEvent

logger = logging.getLogger(__name__)

stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
stripe.api_version = getattr(settings, "STRIPE_API_VERSION", None)


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

    min_dep = Decimal(str(BalanceOperationMixin.MIN_DEPOSIT_AMOUNT))
    if amount_coins < min_dep:
        raise ValueError(f"min deposit is {BalanceOperationMixin.MIN_DEPOSIT_AMOUNT}")

    max_op = Decimal(str(getattr(settings, "MAX_BALANCE_OPERATION_AMOUNT", 100000)))
    if amount_coins > max_op:
        raise ValueError(f"max operation amount is {max_op}")


def _validate_balance_limit(profile: Profile, amount_coins: Decimal) -> None:
    max_balance = Decimal("1000000")
    if profile.balance + amount_coins > max_balance:
        raise ValueError("max balance exceeded")


def create_checkout_session(*, user, amount_coins: Decimal, request_meta: dict | None = None) -> CheckoutSessionResult:
    _validate_amount(amount_coins)

    amount_kopecks = int((amount_coins * 100))
    expires_at_dt = timezone.now() + timedelta(minutes=30)
    expires_at_unix = int(time.time()) + 1800

    metadata = {
        "user_id": str(user.id),
        "amount_coins": str(amount_coins),
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
            amount_kopecks=amount_kopecks,
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
                    "unit_amount": amount_kopecks,
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

        # 3) Apply balance using existing atomic mixin (includes select_for_update)
        profile = Profile.objects.get(user_id=user.id)
        BalanceOperationMixin().perform_balance_operation(profile, payment_session.amount_coins, "deposit")

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

