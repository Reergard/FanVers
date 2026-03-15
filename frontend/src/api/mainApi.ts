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

/** Формує URL обкладинки для книги з новинок. */
export function getBookNewsCoverUrl(book: BookNewsItem): string {
  return resolveBookCoverUrl(book.image);
}
