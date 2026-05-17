from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.payouts.models import PayoutRequest
from apps.users.models import BalanceIdempotencyRecord

# 1 FanCoin = 1 UAH, фіксований курс, не змінюється.
PAYOUT_CURRENCY = "UAH"
EXCHANGE_RATE = Decimal("1.000000")


@transaction.atomic
def create_payout_request(user, coins_amount, method, idempotency_key):
    """
    Створення запиту на виплату: ідемпотентність, перевірки, списання FanCoins,
    розрахунки, знімки реквізитів, async автоперевірка.
    """
    try:
        BalanceIdempotencyRecord.objects.create(
            user=user,
            key=idempotency_key,
            operation_type=BalanceIdempotencyRecord.OP_WITHDRAW,
        )
    except IntegrityError:
        existing = PayoutRequest.objects.filter(
            profile__user=user,
            idempotency_key=idempotency_key,
        ).first()
        if existing:
            return existing
        raise ValidationError("Дублікат запиту")

    profile = user.profile
    payout_profile = user.payout_profile

    if not payout_profile.can_request_payout:
        raise ValidationError("Профіль виплат не схвалено або немає активного методу")

    if coins_amount < settings.PAYOUTS_MIN_AMOUNT_COINS:
        raise ValidationError(
            f"Мінімальна сума виведення: {settings.PAYOUTS_MIN_AMOUNT_COINS} FanCoins"
        )

    if method.is_iban_cooldown_active:
        raise ValidationError("IBAN нещодавно змінено. Зачекайте 7 днів.")

    balance_log = profile.update_balance(coins_amount, "withdraw")

    commission_pct = profile.commission
    commission_coins = coins_amount * commission_pct / Decimal("100")
    coins_after = coins_amount - commission_coins

    # 1 FanCoin = 1 UAH → amount_gross = coins_after_commission
    amount_gross = coins_after

    payout_request = PayoutRequest.objects.create(
        profile=payout_profile,
        method=method,
        balance_log=balance_log,
        idempotency_key=idempotency_key,
        coins_amount=coins_amount,
        commission_percent=commission_pct,
        commission_coins=commission_coins,
        coins_after_commission=coins_after,
        payout_currency=PAYOUT_CURRENCY,
        exchange_rate=EXCHANGE_RATE,
        amount_gross=amount_gross,
        amount_net=amount_gross,
        snapshot_recipient_name=method.recipient_full_name,
        snapshot_iban=method.iban,
        snapshot_bic_swift=method.bic_swift or "",
        snapshot_method_type=method.method_type,
    )

    from apps.payouts.tasks import auto_check_payout_request

    auto_check_payout_request.delay(payout_request.id)

    return payout_request
