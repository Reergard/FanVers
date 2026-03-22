"""Книги, які можна показувати в ТОПі за періодом / публічній каруселі."""

from django.db.models import Count, Q

from apps.catalog.models import Book


def books_eligible_for_top():
    """
    Умови збігаються з очікуванням «книга доступна аноніму в каталозі» + дані для картки:

    - перегляд для всіх (view_permission=all);
    - є власник (не «сирітський» запис);
    - непорожній slug;
    - є обкладинка (карусель без зображення непридатна);
    - хоча б одна глава;
    - переклад зі статусом ABANDONED не потрапляє в ТОП (окремий сценарій каталогу).

    Якщо з’являться поля «чернетка / прихована» — додати їх сюди ж.
    """
    return (
        Book.objects.filter(
            view_permission="all",
            owner__isnull=False,
        )
        .exclude(Q(slug__isnull=True) | Q(slug=""))
        .exclude(Q(image__isnull=True) | Q(image=""))
        .exclude(book_type="TRANSLATION", translation_status="ABANDONED")
        .annotate(_chapters_count=Count("chapters", distinct=True))
        .filter(_chapters_count__gte=1)
    )


def books_eligible_for_trending():
    """
    Книги, які можна враховувати в каруселі «Тренди».

    Зараз умови збігаються з `books_eligible_for_top()`, але це окреме місце:
    сюди можна додати інші правила (статуси, типи, чернетки) без зміни ТОПу.
    """
    return (
        Book.objects.filter(
            view_permission="all",
            owner__isnull=False,
        )
        .exclude(Q(slug__isnull=True) | Q(slug=""))
        .exclude(Q(image__isnull=True) | Q(image=""))
        .exclude(book_type="TRANSLATION", translation_status="ABANDONED")
        .annotate(_chapters_count=Count("chapters", distinct=True))
        .filter(_chapters_count__gte=1)
    )
