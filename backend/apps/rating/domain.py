"""Правила домену: допустимі типи рейтингу та overall_rating за book_type."""

from __future__ import annotations


def available_rating_types(book_type: str) -> list[str]:
    if book_type == "AUTHOR":
        return ["BOOK"]
    if book_type == "TRANSLATION":
        return ["BOOK", "TRANSLATION"]
    # Невідоме / пошкоджене значення: безпечніше лише BOOK (без «фантомного» перекладу)
    return ["BOOK"]


def translation_rating_applicable(book_type: str) -> bool:
    return book_type == "TRANSLATION"


def compute_overall_rating(
    book_type: str,
    book_average: float | None,
    translation_average: float | None,
) -> float:
    """
    Лише TRANSLATION → (book + translation) / 2. Усі інші типи (AUTHOR, невідомий) → середній BOOK.
    """
    b = float(book_average or 0)
    if book_type != "TRANSLATION":
        return round(b, 2)
    t = float(translation_average or 0)
    return round((b + t) / 2, 2)
