"""
Сервіс розрахунку вартості реклами.
Єдине джерело для calculate_cost, perform_create, submit_order.
"""
from decimal import Decimal

PRICE_PER_DAY = {
    "main": Decimal("30.00"),
    "catalog": Decimal("15.00"),
    "genres": Decimal("15.00"),
    "tags": Decimal("15.00"),
    "fandoms": Decimal("15.00"),
}


def calc_days_inclusive(start_date, end_date):
    """Кількість днів включно (start і end вважаються)."""
    return (end_date - start_date).days + 1


def calc_total_cost(location, start_date, end_date):
    """Загальна вартість розміщення."""
    days = calc_days_inclusive(start_date, end_date)
    price = PRICE_PER_DAY.get(location, PRICE_PER_DAY["main"])
    return price * days
