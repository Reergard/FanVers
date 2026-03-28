/** Статус закладки в моделі Bookmark */
export type BookmarkStatus = "reading" | "dropped" | "planned" | "completed";

/** Відповідь API для статусу закладки книги */
export interface BookmarkStatusResponse {
  id: number | null;
  status: BookmarkStatus | null;
}

/** Книга у відповіді закладки (мінімальний набір полів з BookReaderSerializer) */
export interface BookmarkBook {
  id: number;
  slug?: string;
  title: string;
  image?: string | null;
  author?: string | null;
  author_username?: string;
  creator_username?: string;
  owner_username?: string;
  adult_content?: boolean;
  book_type?: string | null;
  is_new_badge?: boolean;
  created_at?: string;
  /** З BookReaderSerializer у вкладеній книзі закладки */
  translation_status?: string | null;
  translation_status_display?: string | null;
}

/** Закладка зі списку користувача */
export interface Bookmark {
  id: number;
  book: BookmarkBook;
  book_id: number;
  status: BookmarkStatus;
  created_at?: string;
  updated_at?: string;
}
