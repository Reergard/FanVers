"""
Financial dashboard for admin index page.
Provides data aggregation and a JSON API endpoint for AJAX updates.
"""

from datetime import timedelta

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum, Count, Avg, Max, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.http import JsonResponse
from django.utils import timezone

from apps.monitoring.models import TransactionLog, AdvertisingLog, AuthorThanks
from apps.payments.models import PaymentSession
from apps.payouts.models import PayoutRequest
from apps.subscription.models import UserBookSubscription
from apps.users.models import Profile, BalanceLog


def _parse_period(period_key):
    now = timezone.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    periods = {
        "today": today,
        "7d": today - timedelta(days=7),
        "30d": today - timedelta(days=30),
        "month": today.replace(day=1),
        "year": today.replace(month=1, day=1),
        "all": None,
    }
    return periods.get(period_key, periods["30d"])


def _prev_period_start(period_key, current_start):
    if current_start is None:
        return None
    now = timezone.now()
    delta = now - current_start
    return current_start - delta


def _decimal(val):
    if val is None:
        return 0
    return float(val)


def _get_kpi_data(start, prev_start):
    filters_cur = {} if start is None else {"created_at__gte": start}
    filters_prev = {} if prev_start is None else {
        "created_at__gte": prev_start,
        "created_at__lt": start,
    }

    def _pct_change(cur, prev):
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # 1. Total turnover
    turnover_cur = _decimal(BalanceLog.objects.filter(
        status="completed", **filters_cur
    ).aggregate(s=Sum("amount"))["s"])
    turnover_prev = _decimal(BalanceLog.objects.filter(
        status="completed", **filters_prev
    ).aggregate(s=Sum("amount"))["s"]) if prev_start else 0

    # 2. Platform commission
    commission_cur = _decimal(TransactionLog.objects.filter(
        **filters_cur
    ).aggregate(s=Sum("commission_amount"))["s"])
    commission_prev = _decimal(TransactionLog.objects.filter(
        **filters_prev
    ).aggregate(s=Sum("commission_amount"))["s"]) if prev_start else 0

    # 3. Deposits
    deposit_filters_cur = {"status": "paid"}
    deposit_filters_prev = {"status": "paid"}
    if start:
        deposit_filters_cur["paid_at__gte"] = start
        deposit_filters_prev["paid_at__gte"] = prev_start
        deposit_filters_prev["paid_at__lt"] = start
    deposits_cur = _decimal(PaymentSession.objects.filter(
        **deposit_filters_cur
    ).aggregate(s=Sum("amount_coins"))["s"])
    deposits_prev = _decimal(PaymentSession.objects.filter(
        **deposit_filters_prev
    ).aggregate(s=Sum("amount_coins"))["s"]) if prev_start else 0

    # 4. Withdrawals (completed)
    wd_filters_cur = {"status": "completed"}
    wd_filters_prev = {"status": "completed"}
    if start:
        wd_filters_cur["completed_at__gte"] = start
        wd_filters_prev["completed_at__gte"] = prev_start
        wd_filters_prev["completed_at__lt"] = start
    withdrawals_cur = _decimal(PayoutRequest.objects.filter(
        **wd_filters_cur
    ).aggregate(s=Sum("coins_amount"))["s"])
    withdrawals_prev = _decimal(PayoutRequest.objects.filter(
        **wd_filters_prev
    ).aggregate(s=Sum("coins_amount"))["s"]) if prev_start else 0

    # 5. Chapter purchases count
    purchases_cur = TransactionLog.objects.filter(**filters_cur).count()
    purchases_prev = TransactionLog.objects.filter(**filters_prev).count() if prev_start else 0

    # 6. Subscriptions count
    subs_cur = UserBookSubscription.objects.filter(**filters_cur).count()
    subs_prev = UserBookSubscription.objects.filter(**filters_prev).count() if prev_start else 0

    # 7. Author thanks
    thanks_cur = _decimal(AuthorThanks.objects.filter(
        **filters_cur
    ).aggregate(s=Sum("amount"))["s"])
    thanks_prev = _decimal(AuthorThanks.objects.filter(
        **filters_prev
    ).aggregate(s=Sum("amount"))["s"]) if prev_start else 0

    # 8. Advertising
    ads_cur = _decimal(AdvertisingLog.objects.filter(
        **filters_cur
    ).aggregate(s=Sum("total_cost"))["s"])
    ads_prev = _decimal(AdvertisingLog.objects.filter(
        **filters_prev
    ).aggregate(s=Sum("total_cost"))["s"]) if prev_start else 0

    return [
        {
            "title": "Загальний оборот",
            "value": turnover_cur,
            "change": _pct_change(turnover_cur, turnover_prev),
            "icon": "account_balance",
        },
        {
            "title": "Дохід платформи (комісія)",
            "value": commission_cur,
            "change": _pct_change(commission_cur, commission_prev),
            "icon": "trending_up",
        },
        {
            "title": "Поповнення",
            "value": deposits_cur,
            "change": _pct_change(deposits_cur, deposits_prev),
            "icon": "add_circle",
        },
        {
            "title": "Виплати (виводи)",
            "value": withdrawals_cur,
            "change": _pct_change(withdrawals_cur, withdrawals_prev),
            "icon": "output",
        },
        {
            "title": "Покупки розділів",
            "value": purchases_cur,
            "change": _pct_change(purchases_cur, purchases_prev),
            "icon": "shopping_cart",
            "is_count": True,
        },
        {
            "title": "Підписки (пакети)",
            "value": subs_cur,
            "change": _pct_change(subs_cur, subs_prev),
            "icon": "card_membership",
            "is_count": True,
        },
        {
            "title": "Подяки авторам",
            "value": thanks_cur,
            "change": _pct_change(thanks_cur, thanks_prev),
            "icon": "volunteer_activism",
        },
        {
            "title": "Реклама",
            "value": ads_cur,
            "change": _pct_change(ads_cur, ads_prev),
            "icon": "campaign",
        },
    ]


def _get_chart_data(start, prev_start):
    filters = {} if start is None else {"created_at__gte": start}

    use_month = False
    if start is not None:
        delta = (timezone.now() - start).days
        use_month = delta > 90
    else:
        use_month = True

    trunc_fn = TruncMonth if use_month else TruncDate

    # Deposits by day
    deposit_filters = {"status": "paid"}
    if start:
        deposit_filters["paid_at__gte"] = start
    deposits_by_day = list(
        PaymentSession.objects.filter(**deposit_filters)
        .annotate(day=trunc_fn("paid_at"))
        .values("day")
        .annotate(total=Sum("amount_coins"))
        .order_by("day")
    )

    # Withdrawals by day
    wd_filters = {"status": "completed"}
    if start:
        wd_filters["completed_at__gte"] = start
    withdrawals_by_day = list(
        PayoutRequest.objects.filter(**wd_filters)
        .annotate(day=trunc_fn("completed_at"))
        .values("day")
        .annotate(total=Sum("coins_amount"))
        .order_by("day")
    )

    # Purchases (sum) by day
    purchases_by_day = list(
        TransactionLog.objects.filter(**filters)
        .annotate(day=trunc_fn("created_at"))
        .values("day")
        .annotate(total=Sum("original_price"))
        .order_by("day")
    )

    # Commission by day
    commission_by_day = list(
        TransactionLog.objects.filter(**filters)
        .annotate(day=trunc_fn("created_at"))
        .values("day")
        .annotate(total=Sum("commission_amount"))
        .order_by("day")
    )

    def _serialize(qs):
        return [
            {"date": r["day"].strftime("%Y-%m-%d" if not use_month else "%Y-%m"), "value": _decimal(r["total"])}
            for r in qs if r["day"]
        ]

    # Bar chart: distribution by operation type
    bar_data = []
    ops = [
        ("Поповнення", "deposit"),
        ("Покупки", "purchase"),
        ("Виплати", "withdraw"),
        ("Подяки", "thanks_given"),
        ("Реклама", "advertising"),
        ("Повернення", "refund"),
    ]
    for label, op_type in ops:
        val = _decimal(BalanceLog.objects.filter(
            operation_type=op_type, status="completed", **filters
        ).aggregate(s=Sum("amount"))["s"])
        bar_data.append({"label": label, "value": val})

    # Bar chart: comparison with previous period
    comparison_data = []
    if prev_start and start:
        prev_filters = {"created_at__gte": prev_start, "created_at__lt": start}
        comp_ops = [
            ("Поповнення", "deposit"),
            ("Покупки", "purchase"),
            ("Виплати", "withdraw"),
            ("Комісії", None),
        ]
        for label, op_type in comp_ops:
            if op_type:
                cur_val = _decimal(BalanceLog.objects.filter(
                    operation_type=op_type, status="completed", **filters
                ).aggregate(s=Sum("amount"))["s"])
                prev_val = _decimal(BalanceLog.objects.filter(
                    operation_type=op_type, status="completed", **prev_filters
                ).aggregate(s=Sum("amount"))["s"])
            else:
                cur_val = _decimal(TransactionLog.objects.filter(
                    **filters
                ).aggregate(s=Sum("commission_amount"))["s"])
                prev_val = _decimal(TransactionLog.objects.filter(
                    **prev_filters
                ).aggregate(s=Sum("commission_amount"))["s"])
            comparison_data.append({
                "label": label,
                "current": cur_val,
                "previous": prev_val,
            })

    return {
        "line": {
            "deposits": _serialize(deposits_by_day),
            "withdrawals": _serialize(withdrawals_by_day),
            "purchases": _serialize(purchases_by_day),
            "commission": _serialize(commission_by_day),
        },
        "bar_distribution": bar_data,
        "bar_comparison": comparison_data,
    }


def _get_balances_data():
    qs = Profile.objects.all()
    total = _decimal(qs.aggregate(s=Sum("balance"))["s"])
    avg = _decimal(qs.aggregate(a=Avg("balance"))["a"])
    with_balance = qs.filter(balance=0).count()
    max_balance = _decimal(qs.aggregate(m=Max("balance"))["m"])
    return {
        "total_balance": total,
        "avg_balance": round(avg, 2),
        "users_with_balance": with_balance,
        "max_balance": max_balance,
    }


def _get_payouts_status_data():
    statuses = [
        {"key": "pending", "label": "Очікують розгляду", "color": "#f59e0b",
         "filter": Q(status="pending") | Q(status="awaiting_review")},
        {"key": "approved", "label": "Схвалені", "color": "#3b82f6",
         "filter": Q(status="approved")},
        {"key": "processing", "label": "В обробці", "color": "#8b5cf6",
         "filter": Q(status="in_batch") | Q(status="processing")},
        {"key": "completed", "label": "Завершені", "color": "#10b981",
         "filter": Q(status="completed")},
        {"key": "failed", "label": "Відхилені/помилки", "color": "#ef4444",
         "filter": Q(status="failed") | Q(status="cancelled")},
    ]
    result = []
    for s in statuses:
        count = PayoutRequest.objects.filter(s["filter"]).count()
        result.append({
            "label": s["label"],
            "count": count,
            "color": s["color"],
            "key": s["key"],
        })

    urgent_count = PayoutRequest.objects.filter(
        is_urgent=True
    ).exclude(
        status__in=["completed", "cancelled", "failed"]
    ).count()

    return {"statuses": result, "urgent_count": urgent_count}


def _get_recent_tables(start):
    filters = {} if start is None else {"created_at__gte": start}

    # Recent deposits
    deposit_filters = {"status": "paid"}
    if start:
        deposit_filters["paid_at__gte"] = start
    deposits = list(
        PaymentSession.objects.filter(**deposit_filters)
        .order_by("-paid_at")[:10]
        .values(
            "paid_at", "user__username", "amount_coins",
            "amount_kopecks", "currency", "status"
        )
    )
    for d in deposits:
        d["paid_at"] = d["paid_at"].strftime("%d.%m.%Y %H:%M") if d["paid_at"] else ""
        d["amount_coins"] = _decimal(d["amount_coins"])
        d["amount_currency"] = round((d["amount_kopecks"] or 0) / 100, 2)

    # Recent purchases
    purchases = list(
        TransactionLog.objects.filter(**filters)
        .order_by("-created_at")[:10]
        .values(
            "created_at",
            "buyer__user__username",
            "owner__user__username",
            "book__title",
            "original_price",
            "commission_amount",
            "commission_percent",
            "final_amount",
        )
    )
    for p in purchases:
        p["created_at"] = p["created_at"].strftime("%d.%m.%Y %H:%M")
        p["original_price"] = _decimal(p["original_price"])
        p["commission_amount"] = _decimal(p["commission_amount"])
        p["commission_percent"] = _decimal(p["commission_percent"])
        p["final_amount"] = _decimal(p["final_amount"])

    # Recent payouts
    payouts = list(
        PayoutRequest.objects.filter(**filters)
        .order_by("-created_at")[:10]
        .values(
            "created_at",
            "profile__user__username",
            "coins_amount",
            "commission_coins",
            "commission_percent",
            "amount_net",
            "payout_currency",
            "status",
            "is_urgent",
        )
    )
    for p in payouts:
        p["created_at"] = p["created_at"].strftime("%d.%m.%Y %H:%M")
        p["coins_amount"] = _decimal(p["coins_amount"])
        p["commission_coins"] = _decimal(p["commission_coins"])
        p["commission_percent"] = _decimal(p["commission_percent"])
        p["amount_net"] = _decimal(p["amount_net"])

    # Recent thanks
    thanks = list(
        AuthorThanks.objects.filter(**filters)
        .order_by("-created_at")[:10]
        .values(
            "created_at",
            "giver__username",
            "receiver__username",
            "book__title",
            "amount",
        )
    )
    for t in thanks:
        t["created_at"] = t["created_at"].strftime("%d.%m.%Y %H:%M")
        t["amount"] = _decimal(t["amount"])

    return {
        "deposits": deposits,
        "purchases": purchases,
        "payouts": payouts,
        "thanks": thanks,
    }


def _get_users_data():
    role_labels = {
        "Читач": "Читачі",
        "Перекладач": "Перекладачі",
        "Літератор": "Літератори",
    }
    roles = Profile.objects.values("role").annotate(count=Count("id"))
    role_data = {role_labels.get(r["role"], r["role"]): r["count"] for r in roles}
    total_users = sum(role_data.values())

    commission_data = [
        {"label": "Комісія 15%", "count": Profile.objects.filter(commission=15).count()},
        {"label": "Комісія 12%", "count": Profile.objects.filter(commission=12).count()},
        {"label": "Комісія 10%", "count": Profile.objects.filter(commission=10).count()},
    ]

    return {
        "roles": role_data,
        "total_users": total_users,
        "commission": commission_data,
    }


VALID_PERIODS = {"today", "7d", "30d", "month", "year", "all"}


@staff_member_required
def dashboard_api(request):
    period = request.GET.get("period", "30d")
    if period not in VALID_PERIODS:
        period = "30d"
    start = _parse_period(period)
    prev_start = _prev_period_start(period, start)

    data = {
        "kpi": _get_kpi_data(start, prev_start),
        "charts": _get_chart_data(start, prev_start),
        "balances": _get_balances_data(),
        "payouts_status": _get_payouts_status_data(),
        "tables": _get_recent_tables(start),
        "users": _get_users_data(),
    }
    return JsonResponse(data)


def dashboard_callback(request, context):
    from django.urls import reverse
    context["dashboard_data"] = True
    context["admin_dashboard_api_url"] = reverse("admin_dashboard_api")
    return context
