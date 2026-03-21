import { http } from "./http";
import { API } from "./endpoints";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";

/** Книга з API новинок (books-news). */
export interface BookNewsItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  image: string | null;
  adult_content: boolean;
  created_at: string | null;
}

function normalizeBookNews(raw: unknown): BookNewsItem | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    slug: String(o.slug ?? ""),
    title: String(o.title ?? ""),
    description: o.description != null && o.description !== "" ? String(o.description) : null,
    image:
      o.cover_image != null && o.cover_image !== ""
        ? String(o.cover_image)
        : o.image != null && o.image !== ""
          ? String(o.image)
          : null,
    adult_content: o.adult_content === true,
    created_at: o.created_at != null ? String(o.created_at) : null,
  };
}

/** Список новинок для блоку НОВИНКИ на головній сторінці. */
export async function getBooksNews(): Promise<BookNewsItem[]> {
  const { data } = await http.get<unknown[]>(API.booksNews);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeBookNews).filter((b): b is BookNewsItem => b != null);
}

/** Книга з API «останні оновлення» (той самий серіалізатор, що й новинки, з полями про глави). */
export interface BookRecentUpdateItem extends BookNewsItem {
  latest_chapter_title: string | null;
  chapters_count: number;
}

function normalizeBookRecentUpdate(raw: unknown): BookRecentUpdateItem | null {
  const base = normalizeBookNews(raw);
  if (!base) return null;
  const o = raw as Record<string, unknown>;
  const latest =
    o.latest_chapter_title != null && String(o.latest_chapter_title).trim() !== ""
      ? String(o.latest_chapter_title)
      : null;
  const n = Number(o.chapters_count);
  return {
    ...base,
    latest_chapter_title: latest,
    chapters_count: Number.isFinite(n) ? n : 0,
  };
}

/** Список книг з недавніми оновленнями глав (ОСТАННІ ОНОВЛЕННЯ). */
export async function getBooksRecentUpdates(): Promise<BookRecentUpdateItem[]> {
  const { data } = await http.get<unknown[]>(API.booksRecentUpdates);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeBookRecentUpdate).filter((b): b is BookRecentUpdateItem => b != null);
}

/** Формує URL обкладинки для книги з новинок. */
export function getBookNewsCoverUrl(book: BookNewsItem): string {
  return resolveBookCoverUrl(book.image);
}

/** Текст під карткою: остання глава або скорочений опис. */
export function getRecentUpdateCardCaption(book: BookRecentUpdateItem): string {
  const chapter = book.latest_chapter_title?.trim();
  if (chapter) {
    const line = `Остання глава: ${chapter}`;
    return line.length > 500 ? `${line.slice(0, 500)}…` : line;
  }
  const desc = book.description?.trim();
  if (desc) {
    return desc.length > 500 ? `${desc.slice(0, 500)}…` : desc;
  }
  if (book.chapters_count > 0) {
    return `Глав: ${book.chapters_count} · нещодавнє оновлення`;
  }
  return "Нещодавнє оновлення";
}
