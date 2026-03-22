#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Одноразовий аудит: які книги проходять умови каруселі «ТОП» і що поверне get_top_books.

Запуск:
    з кореня репозиторію:  python audit_top_eligibility.py
    з каталогу backend:   python audit_top_eligibility.py

Опції: --skip-ineligible

Після перевірки можна видалити backend/audit_top_eligibility.py та кореневу обгортку audit_top_eligibility.py.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FanVers_project.settings")

import django  # noqa: E402

django.setup()

from django.utils import timezone  # noqa: E402

from apps.analytics_books.models import BookAnalytics, DailyAnalytics  # noqa: E402
from apps.analytics_books.services.books_filter import books_eligible_for_top  # noqa: E402
from apps.analytics_books.services.scoring import (  # noqa: E402
    book_analytics_total_score,
    daily_row_score,
)
from apps.analytics_books.services.top import (  # noqa: E402
    MIN_TOP_SCORE_PERIOD,
    get_top_books,
    top_limit_for_period,
)
from apps.catalog.models import Book  # noqa: E402


def eligibility_reasons(book: Book) -> list[str]:
    """Дзеркало умов books_eligible_for_top() з поясненнями."""
    reasons: list[str] = []
    if book.view_permission != "all":
        reasons.append(f"view_permission={book.view_permission!r} (потрібно 'all')")
    if book.owner_id is None:
        reasons.append("немає owner")
    if not book.slug or not str(book.slug).strip():
        reasons.append("порожній slug")
    if book.image is None or str(book.image).strip() == "":
        reasons.append("немає обкладинки (image)")
    if book.book_type == "TRANSLATION" and book.translation_status == "ABANDONED":
        reasons.append("TRANSLATION + translation_status=ABANDONED (виключено з ТОПу)")
    ch = book.chapters.count()
    if ch < 1:
        reasons.append(f"немає глав (chapters={ch})")
    return reasons


def period_scores_for_book(book_id: int) -> dict[str, float | int | None]:
    today = timezone.now().date()
    week_start = today - timedelta(days=6)
    month_start = today - timedelta(days=29)

    day_row = DailyAnalytics.objects.filter(book_id=book_id, date=today).first()
    day_score = daily_row_score(day_row) if day_row else 0

    week_rows = DailyAnalytics.objects.filter(book_id=book_id, date__gte=week_start)
    week_score = sum(daily_row_score(d) for d in week_rows)

    month_rows = DailyAnalytics.objects.filter(book_id=book_id, date__gte=month_start)
    month_score = sum(daily_row_score(d) for d in month_rows)

    ba = BookAnalytics.objects.filter(book_id=book_id).first()
    all_time_total = book_analytics_total_score(ba) if ba else 0

    return {
        "day": day_score,
        "week": week_score,
        "month": month_score,
        "all_time_weighted_total": all_time_total,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Аудит ТОПу (книги + get_top_books)")
    parser.add_argument(
        "--skip-ineligible",
        action="store_true",
        help="Не друкувати список книг, що не проходять структурний фільтр",
    )
    args = parser.parse_args()

    eligible_qs = books_eligible_for_top().order_by("id")
    eligible_ids = set(eligible_qs.values_list("id", flat=True))

    print("=" * 72)
    print("ТОП: структурна придатність (books_eligible_for_top)")
    print("=" * 72)
    print(f"Умови: view_permission=all, owner, slug, обкладинка, ≥1 глава,")
    print(f"        не (TRANSLATION + ABANDONED)")
    print(f"Поріг зважених очок: MIN_TOP_SCORE_PERIOD = {MIN_TOP_SCORE_PERIOD}")
    print()

    if not args.skip_ineligible:
        ineligible = Book.objects.exclude(pk__in=eligible_ids).order_by("id")
        n_bad = ineligible.count()
        print(f"--- Не проходять фільтр ({n_bad} книг) ---")
        for b in ineligible:
            r = eligibility_reasons(b)
            extra = "; ".join(r) if r else "(перевірте вручну — умови змінились)"
            print(f"  id={b.id} slug={b.slug!r}  →  {extra}")
        print()

    print(f"--- Проходять фільтр ({len(eligible_ids)} книг) ---")
    for b in eligible_qs:
        sc = period_scores_for_book(b.id)
        flags = []
        for key in ("day", "week", "month"):
            v = sc[key]
            flags.append(f"{key}>={MIN_TOP_SCORE_PERIOD}: {v >= MIN_TOP_SCORE_PERIOD} (score={v})")
        at = sc["all_time_weighted_total"]
        flags.append(
            f"all_time>={MIN_TOP_SCORE_PERIOD}: {at >= MIN_TOP_SCORE_PERIOD} (total={at})"
        )
        print(f"  id={b.id} slug={b.slug!r}")
        print(f"      " + " | ".join(flags))
    print()

    print("=" * 72)
    print("Результат як у API (get_top_books + ліміт)")
    print("=" * 72)
    for period in ("day", "week", "month", "all_time"):
        lim = top_limit_for_period(period)
        books = get_top_books(period, lim)
        print(f"\n--- type={period!r}  limit={lim}  returned={len(books)} ---")
        for i, bk in enumerate(books, start=1):
            sc = period_scores_for_book(bk.id)
            if period == "day":
                detail = f"day_score={sc['day']}"
            elif period == "week":
                detail = f"week_sum={sc['week']}"
            elif period == "month":
                detail = f"month_sum={sc['month']}"
            else:
                detail = f"all_time_total={sc['all_time_weighted_total']}"
            print(f"  {i}. id={bk.id} slug={bk.slug!r}  ({detail})")

    print()
    print("Готово.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
