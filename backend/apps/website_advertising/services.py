"""
Єдине джерело: розрахунок ціни, валідація слотів, ранжування реклами пошуку.
"""
from collections import defaultdict
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from apps.catalog.models import Fandom, Genres, Tag

# --- Ціни за день (FanCoins) ---
PRICE_MAIN = Decimal("30.00")
PRICE_CATALOG = Decimal("15.00")
# search
PRICE_SEARCH_GENERAL = Decimal("15.00")
PRICE_SEARCH_GENRE = Decimal("18.00")
PRICE_SEARCH_TAG = Decimal("12.00")
PRICE_SEARCH_FANDOM = Decimal("18.00")

# Ранжування пошуку
SEARCH_CAROUSEL_MAX = 12
SCORE_GENERAL = 10
SCORE_GENRE = 100
SCORE_TAG = 40
SCORE_FANDOM = 80
MAX_SCORE_GENRES = 5
MAX_SCORE_TAGS = 5
MAX_SCORE_FANDOMS = 1


def validate_date_order(start_date, end_date):
    """Інваріант: початок не пізніше за кінець."""
    if start_date > end_date:
        raise ValidationError(
            "Дата початку не може бути пізніше дати закінчення"
        )


def validate_new_campaign_start_not_in_past(start_date, reference_date=None):
    """Для нової кампанії: дата початку не в минулому (відносно reference_date)."""
    ref = reference_date or timezone.now().date()
    if start_date < ref:
        raise ValidationError(
            "Дата початку не може бути раніше поточної дати"
        )


def validate_dates_for_new_campaign(start_date, end_date, reference_date=None):
    """Єдине правило для нового замовлення реклами (submit_order тощо)."""
    validate_date_order(start_date, end_date)
    validate_new_campaign_start_not_in_past(start_date, reference_date)


def _dedupe_ids_preserve_order(raw_ids, max_n):
    """Унікальні id у порядку першої появи, максимум max_n."""
    seen = set()
    out = []
    for x in raw_ids or []:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
        if len(out) >= max_n:
            break
    return out


def normalize_search_filter_ids(genre_ids, tag_ids, fandom_ids):
    """
    Єдине місце дедупу id з query string / клієнта перед ранжуванням.
    Повтори (наприклад tag_ids=7,7,7) не збільшують score.
    """
    g = _dedupe_ids_preserve_order(
        [int(x) for x in (genre_ids or [])], MAX_SCORE_GENRES
    )
    t = _dedupe_ids_preserve_order(
        [int(x) for x in (tag_ids or [])], MAX_SCORE_TAGS
    )
    f = _dedupe_ids_preserve_order(
        [int(x) for x in (fandom_ids or [])], MAX_SCORE_FANDOMS
    )
    return g, t, f


def calc_days_inclusive(start_date, end_date):
    """Кількість днів включно (start і end вважаються)."""
    return (end_date - start_date).days + 1


def price_per_day(location: str, target_kind: str) -> Decimal:
    """Ціна за один день для слота."""
    if location == "main":
        if target_kind != "none":
            raise ValidationError("Для головної сторінки таргетинг не дозволений")
        return PRICE_MAIN
    if location == "catalog":
        if target_kind != "none":
            raise ValidationError("Для каталогу таргетинг не дозволений")
        return PRICE_CATALOG
    if location == "search":
        if target_kind == "none":
            return PRICE_SEARCH_GENERAL
        if target_kind == "genre":
            return PRICE_SEARCH_GENRE
        if target_kind == "tag":
            return PRICE_SEARCH_TAG
        if target_kind == "fandom":
            return PRICE_SEARCH_FANDOM
    raise ValidationError("Невідоме розміщення або тип таргету")


def calc_total_cost(location: str, start_date, end_date, target_kind: str = "none"):
    """Загальна вартість розміщення (сервер — єдине джерело істини)."""
    days = calc_days_inclusive(start_date, end_date)
    price = price_per_day(location, target_kind)
    return price * days


def validate_target_ref(target_kind: str, target_id):
    """Перевірка існування сутності для target_id."""
    if target_kind == "none":
        if target_id is not None:
            raise ValidationError("Для загального розміщення target_id має бути порожнім")
        return
    if target_id is None:
        raise ValidationError("Оберіть об'єкт таргетингу")
    tid = int(target_id)
    if target_kind == "genre":
        if not Genres.objects.filter(pk=tid).exists():
            raise ValidationError("Жанр не знайдено")
    elif target_kind == "tag":
        if not Tag.objects.filter(pk=tid).exists():
            raise ValidationError("Тег не знайдено")
    elif target_kind == "fandom":
        if not Fandom.objects.filter(pk=tid).exists():
            raise ValidationError("Фендом не знайдено")
    else:
        raise ValidationError("Невідомий target_kind")


def validate_location_target_pair(location: str, target_kind: str, target_id):
    """Правила для main / catalog / search."""
    if location in ("main", "catalog"):
        if target_kind != "none" or target_id is not None:
            raise ValidationError("Для головної та каталогу таргетинг недоступний")
        return
    if location == "search":
        validate_target_ref(target_kind, target_id)
        return
    raise ValidationError("Невідоме місце розміщення")


def overlapping_ads_qs(
    book,
    location: str,
    target_kind: str,
    target_id,
    start_date,
    end_date,
    is_active=True,
):
    """Queryset пересічних активних кампаній для тієї ж книги та того ж слота."""
    from .models import Advertisement

    q = Q(
        book=book,
        location=location,
        start_date__lte=end_date,
        end_date__gte=start_date,
        is_active=is_active,
    )
    if target_kind == "none":
        q &= Q(target_kind="none") & Q(target_id__isnull=True)
    else:
        q &= Q(target_kind=target_kind) & Q(target_id=target_id)

    return Advertisement.objects.filter(q)


def assert_no_overlap(
    book,
    location: str,
    target_kind: str,
    target_id,
    start_date,
    end_date,
    exclude_pk=None,
):
    qs = overlapping_ads_qs(
        book, location, target_kind, target_id, start_date, end_date, is_active=True
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise ValidationError(
            f'Для книги "{book.title}" вже є активна реклама на вибрані дати для цього слота'
        )


def rank_search_ads(advertisement_model, gids, tids, fids):
    """
    Активні search-кампанії на сьогодні, dedup по book_id, сортування за score, top SEARCH_CAROUSEL_MAX.
    Повертає список екземплярів Advertisement (по одному на книгу).

    gids, tids, fids — списки id після normalize_search_filter_ids (дедуп у порядку появи, ліміти).
    """
    current_date = timezone.now().date()
    base = advertisement_model.objects.filter(
        location="search",
        is_active=True,
        start_date__lte=current_date,
        end_date__gte=current_date,
    ).select_related("book")

    has_filters = bool(gids or tids or fids)

    if not has_filters:
        candidates = list(
            base.filter(target_kind="none", target_id__isnull=True).order_by(
                "-created_at", "-pk"
            )
        )
        return candidates[:SEARCH_CAROUSEL_MAX]

    q = Q(target_kind="none", target_id__isnull=True)
    for gid in gids:
        q |= Q(target_kind="genre", target_id=gid)
    for tid in tids:
        q |= Q(target_kind="tag", target_id=tid)
    for fid in fids:
        q |= Q(target_kind="fandom", target_id=fid)

    candidates = list(base.filter(q))

    by_book = defaultdict(list)
    for ad in candidates:
        by_book[ad.book_id].append(ad)

    scored_rows = []
    for book_id, ads in by_book.items():
        score = _score_book_ads(ads, gids, tids, fids, has_filters)
        # представник — найновіша реклама серед групи
        rep = max(ads, key=lambda a: (a.created_at, a.pk))
        scored_rows.append((score, rep))

    # Стабільне сортування: score desc, потім pk desc (передбачуваний tie-break)
    scored_rows.sort(key=lambda x: (-x[0], -x[1].pk))
    return [rep for _, rep in scored_rows[:SEARCH_CAROUSEL_MAX]]


def _score_book_ads(ads, genre_ids, tag_ids, fandom_ids, has_filters):
    score = 0
    if not has_filters:
        if any(a.target_kind == "none" for a in ads):
            score += SCORE_GENERAL
        return score

    if any(a.target_kind == "none" for a in ads):
        score += SCORE_GENERAL

    for gid in genre_ids:
        if any(a.target_kind == "genre" and a.target_id == gid for a in ads):
            score += SCORE_GENRE
    for tid in tag_ids:
        if any(a.target_kind == "tag" and a.target_id == tid for a in ads):
            score += SCORE_TAG
    for fid in fandom_ids:
        if any(a.target_kind == "fandom" and a.target_id == fid for a in ads):
            score += SCORE_FANDOM
    return score
