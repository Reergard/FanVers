import type { CreateBookPayload, UpdateBookPayload } from "../../../api/catalogApi";
import type { BookFormData, BookFormMode } from "./BookForm";

export const DESCRIPTION_MAX_CHARS = 900;
/** Статуси перекладу, заборонені для нових книг при створенні */
export const INVALID_NEW_BOOK_TRANSLATION_STATUSES = ["PAUSED", "ABANDONED", "COMPLETED"];

type ValidateContext = {
  mode: BookFormMode;
};

export function validateBookForm(state: BookFormData, ctx: ValidateContext): string[] {
  const errors: string[] = [];

  if (!state.title?.trim()) errors.push("Назва книги обов'язкова");
  if (!state.author?.trim()) errors.push("Ім'я автора обов'язкове");

  if (state.description && state.description.length > DESCRIPTION_MAX_CHARS) {
    errors.push(`Опис не може перевищувати ${DESCRIPTION_MAX_CHARS} символів`);
  }

  if (state.genres.length === 0) errors.push("Виберіть хоча б один жанр");

  const countryId = Number(state.country);
  if (!state.country) errors.push("Виберіть країну");
  else if (Number.isNaN(countryId)) errors.push("Невірна країна");

  if (!state.original_status) errors.push("Оберіть статус випуску оригіналу");

  if (state.book_type === "TRANSLATION") {
    if (!state.translation_status) errors.push("Оберіть статус перекладу");
    if (
      ctx.mode === "create" &&
      state.translation_status &&
      INVALID_NEW_BOOK_TRANSLATION_STATUSES.includes(state.translation_status)
    ) {
      errors.push("Для нових книг використовуйте статус «Перекладається» або «В очікуванні розділів»");
    }
  }

  return errors;
}

export function normalizeBookPayload(
  state: BookFormData,
  mode: BookFormMode
): CreateBookPayload | UpdateBookPayload {
  const payloadBase = {
    title: state.title.trim(),
    title_en: state.title_en.trim() || undefined,
    author: state.author.trim(),
    description: state.description.trim() || undefined,
    book_type: state.book_type,
    translation_status: state.book_type === "AUTHOR" ? null : state.translation_status || "TRANSLATING",
    original_status: state.original_status,
    country: Number(state.country),
    genres: state.genres,
    tags: state.tags,
    fandoms: state.fandoms,
    adult_content: state.adult_content,
    image: state.image ?? undefined,
  };

  if (mode === "create") {
    return payloadBase as CreateBookPayload;
  }

  return payloadBase as UpdateBookPayload;
}
