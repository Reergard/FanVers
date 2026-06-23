import logging
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.payouts.models import PayoutRequest
from apps.users.models import BalanceIdempotencyRecord

logger = logging.getLogger(__name__)

# 1 FanCoin = 1 UAH.
# exchange_rate встановлюється адміном при ревью заявки (UAH → payout_currency).
# Початкове значення 1.0 — для UAH-отримувачів коректне, для інших валют
# адмін ОБОВ'ЯЗКОВО оновлює курс перед створенням batch.
INITIAL_EXCHANGE_RATE = Decimal("1.000000")


@transaction.atomic
def create_payout_request(
    user, coins_amount, method, idempotency_key,
    skip_profile_approval_check=False,
    is_urgent=False,
):
    """
    Створення запиту на виплату: ідемпотентність, перевірки, списання FanCoins,
    розрахунки, знімки реквізитів.

    Усі заявки створюються зі статусом AWAITING_REVIEW —
    одобрення відбувається лише вручну адміністратором.

    skip_profile_approval_check=True — при першій подачі заявки (PayoutProfileSubmitView),
    коли профіль ще у статусі DRAFT/REJECTED і не пройшов верифікацію.
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

    if not skip_profile_approval_check and not payout_profile.can_request_payout:
        raise ValidationError("Профіль виплат не схвалено або немає активного методу")

    if coins_amount < settings.PAYOUTS_MIN_AMOUNT_COINS:
        raise ValidationError(
            f"Мінімальна сума виведення: {settings.PAYOUTS_MIN_AMOUNT_COINS} FanCoins"
        )

    if coins_amount > settings.PAYOUTS_MAX_AMOUNT_COINS:
        raise ValidationError(
            f"Максимальна сума виведення: {settings.PAYOUTS_MAX_AMOUNT_COINS} FanCoins"
        )

    # Перевірка: IBAN має бути розшифрований коректно
    iban_value = method.iban
    if not iban_value or iban_value.startswith("["):
        raise ValidationError(
            "Помилка зчитування реквізитів. Зверніться до підтримки."
        )

    balance_log = profile.balance_operation(coins_amount, "withdraw")

    # Комісія: 0% за звичайний вивід, 10% за терміновий
    if is_urgent:
        commission_pct = settings.PAYOUT_URGENT_COMMISSION_PERCENT
        commission_coins = (coins_amount * commission_pct / Decimal("100")).quantize(
            Decimal("0.01")
        )
    else:
        commission_pct = Decimal("0.00")
        commission_coins = Decimal("0.00")
    coins_after = coins_amount - commission_coins

    # 1 FanCoin = 1 UAH → amount_gross завжди в UAH
    amount_gross_uah = coins_after

    if method.currency == "UAH":
        exchange_rate = Decimal("1.000000")
        amount_net = amount_gross_uah
    else:
        exchange_rate = INITIAL_EXCHANGE_RATE
        amount_net = amount_gross_uah

    payout_request = PayoutRequest.objects.create(
        profile=payout_profile,
        method=method,
        balance_log=balance_log,
        idempotency_key=idempotency_key,
        is_urgent=is_urgent,
        coins_amount=coins_amount,
        commission_percent=commission_pct,
        commission_coins=commission_coins,
        coins_after_commission=coins_after,
        payout_currency=method.currency,
        exchange_rate=exchange_rate,
        amount_gross=amount_gross_uah,
        amount_net=amount_net,
        status=PayoutRequest.Status.AWAITING_REVIEW,
        # KYC snapshot
        snapshot_country=payout_profile.country,
        snapshot_full_name_legal=payout_profile.full_name_legal,
        snapshot_full_name_latin=payout_profile.full_name_latin,
        snapshot_address_line=payout_profile.address_line,
        snapshot_city=payout_profile.city,
        snapshot_postal_code=payout_profile.postal_code,
        # Реквізити snapshot
        snapshot_recipient_name=method.recipient_full_name,
        snapshot_iban=iban_value,
        snapshot_bic_swift=method.bic_swift or "",
        snapshot_method_type=method.method_type,
    )

    logger.info(
        "Payout request #%s created: %s UAH (gross), %s %s (net), user=%s, urgent=%s, commission=%s%%",
        payout_request.id, amount_gross_uah, amount_net, method.currency,
        user.username, is_urgent, commission_pct,
    )

    return payout_request
