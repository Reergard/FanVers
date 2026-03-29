import { http } from "./http";
import { API } from "./endpoints";

export type RatingType = "BOOK" | "TRANSLATION";

export interface RatingStats {
  average: number;
  total_votes: number;
}

export interface UserRatingItem {
  rating_type: string;
  rating: number;
}

export interface BookRatingsResponse {
  book_type?: string;
  available_rating_types?: string[];
  /** З бекенду: true/false; false = блок перекладу не застосовується (AUTHOR) */
  has_translation_rating?: boolean;
  /** Зведена оцінка: AUTHOR — середній BOOK; TRANSLATION — (BOOK+TRANSLATION)/2 */
  overall_rating?: number;
  book_rating: RatingStats;
  /** Для AUTHOR — null (не «нуль голосів», а не застосовується) */
  translation_rating: RatingStats | null;
  user_ratings: UserRatingItem[] | null;
}

/** Діапазон 0–5 (для середнього можливі дроби). */
const clampRating = (n: unknown): number => {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.min(5, Math.max(0, v));
};

const clampTotalVotes = (n: unknown): number =>
  Math.max(0, Math.floor(Number(n) || 0));

/** Нормалізація відповіді API: завжди числа в діапазоні, без null/undefined в полях book_rating. */
function normalizeRatingsResponse(raw: unknown): BookRatingsResponse {
  if (raw == null || typeof raw !== "object") {
    return {
      book_rating: { average: 0, total_votes: 0 },
      translation_rating: null,
      user_ratings: null,
    };
  }
  const o = raw as Record<string, unknown>;
  const book = o.book_rating as Record<string, unknown> | undefined;
  const translationRaw = o.translation_rating;
  const userList = Array.isArray(o.user_ratings) ? o.user_ratings : null;
  const userRatings = userList
    ? userList
        .filter((u) => u != null && typeof u === "object")
        .map((u) => {
          const item = u as Record<string, unknown>;
          const r = clampRating(item.rating);
          return {
            rating_type: String(item.rating_type ?? ""),
            rating: r >= 1 && r <= 5 ? r : 0,
          };
        })
        .filter((u) => u.rating >= 1 && u.rating <= 5)
    : null;

  const bookType = typeof o.book_type === "string" ? o.book_type : "";
  const apiHasTr = o.has_translation_rating;
  const noTranslationBlock =
    apiHasTr === false ||
    bookType === "AUTHOR" ||
    (translationRaw === null && bookType !== "TRANSLATION");

  let translation_rating: RatingStats | null = null;
  if (!noTranslationBlock && translationRaw != null && typeof translationRaw === "object") {
    const tr = translationRaw as Record<string, unknown>;
    translation_rating = {
      average: clampRating(tr?.average ?? 0),
      total_votes: clampTotalVotes(tr?.total_votes ?? 0),
    };
  }

  const overallRaw = o.overall_rating;
  const overall_rating =
    typeof overallRaw === "number" && !Number.isNaN(overallRaw)
      ? overallRaw
      : typeof overallRaw === "string" && overallRaw.trim() !== ""
        ? Number(overallRaw)
        : undefined;

  const hasTrComputed =
    !noTranslationBlock && translation_rating !== null;

  const has_translation_rating: boolean | undefined =
    typeof apiHasTr === "boolean"
      ? apiHasTr
      : hasTrComputed
        ? true
        : undefined;

  return {
    book_type: bookType || undefined,
    available_rating_types: Array.isArray(o.available_rating_types)
      ? (o.available_rating_types as string[]).filter((x) => typeof x === "string")
      : undefined,
    has_translation_rating,
    overall_rating: overall_rating !== undefined && !Number.isNaN(overall_rating) ? overall_rating : undefined,
    book_rating: {
      average: clampRating(book?.average ?? 0),
      total_votes: clampTotalVotes(book?.total_votes ?? 0),
    },
    translation_rating,
    user_ratings: userRatings?.length ? userRatings : null,
  };
}

/** Отримання рейтингів книги (рейтинг твору + за потреби якість перекладу) та оцінки поточного користувача. */
export async function fetchBookRatings(bookSlug: string): Promise<BookRatingsResponse> {
  if (!bookSlug || typeof bookSlug !== "string" || !bookSlug.trim()) {
    return normalizeRatingsResponse(null);
  }
  const { data } = await http.get<unknown>(API.ratingBookRatings(bookSlug.trim()));
  return normalizeRatingsResponse(data);
}

/** Надсилання оцінки (1–5). Потрібна авторизація; http підставляє Bearer. */
export async function submitRating(
  bookSlug: string,
  ratingType: RatingType,
  rating: number
): Promise<unknown> {
  const value = Math.min(5, Math.max(1, Math.floor(Number(rating) || 0))) || 1;
  const slug = typeof bookSlug === "string" && bookSlug.trim() ? bookSlug.trim() : "";
  if (!slug) {
    throw new Error("Slug книги обовʼязковий");
  }
  if (ratingType !== "BOOK" && ratingType !== "TRANSLATION") {
    throw new Error("Невірний тип рейтингу");
  }
  const { data } = await http.post(API.ratingSubmit, {
    book_slug: slug,
    rating_type: ratingType,
    rating: value,
  });
  return data;
}
