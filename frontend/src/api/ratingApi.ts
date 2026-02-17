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
  book_rating: RatingStats;
  translation_rating: RatingStats;
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

/** Нормалізація відповіді API: завжди числа в діапазоні, без null/undefined в полях. */
function normalizeRatingsResponse(raw: unknown): BookRatingsResponse {
  if (raw == null || typeof raw !== "object") {
    return {
      book_rating: { average: 0, total_votes: 0 },
      translation_rating: { average: 0, total_votes: 0 },
      user_ratings: null,
    };
  }
  const o = raw as Record<string, unknown>;
  const book = o.book_rating as Record<string, unknown> | undefined;
  const translation = o.translation_rating as Record<string, unknown> | undefined;
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

  return {
    book_rating: {
      average: clampRating(book?.average ?? 0),
      total_votes: clampTotalVotes(book?.total_votes ?? 0),
    },
    translation_rating: {
      average: clampRating(translation?.average ?? 0),
      total_votes: clampTotalVotes(translation?.total_votes ?? 0),
    },
    user_ratings: userRatings?.length ? userRatings : null,
  };
}

/** Отримання рейтингів книги (рейтинг твору + якість перекладу) та оцінки поточного користувача. */
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
