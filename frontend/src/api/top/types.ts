/**
 * DTO для **ТОПу за періодом**: BookReaderSerializer (GET /api/analytics_books/top/).
 * Поля — фактичні ключі JSON; частина опційна для стійкості до змін.
 */

export type TopPeriod = "day" | "week" | "month" | "all_time";

export interface BookReaderTopMeta {
  id: number;
  name: string;
}

export interface BookReaderTopCountry {
  id: number;
  name: string;
}

/** Нормалізований рядок після парсу сирого JSON */
export interface BookReaderTopDto {
  id: number;
  slug: string;
  title: string;
  title_en: string | null;
  author: string;
  description: string | null;
  image: string | null;
  translation_status: string | null;
  translation_status_display: string | null;
  original_status: string | null;
  original_status_display: string | null;
  country: BookReaderTopCountry | null;
  last_updated: string | null;
  owner_username: string | null;
  creator_username: string | null;
  bookmark_status: string | null;
  bookmark_id: number | null;
  adult_content: boolean;
  book_type: string | null;
  chapters_count: number;
  genres: BookReaderTopMeta[];
  tags: BookReaderTopMeta[];
  fandoms: BookReaderTopMeta[];
  created_at: string | null;
}
