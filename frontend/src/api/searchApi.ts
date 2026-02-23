import { API } from "./endpoints";
import { http } from "./http";
import type { BookMetaItem, BookCountry, UserTranslationBook } from "./catalogApi";

export type SearchFilters = {
  title?: string;
  genres?: number[];
  tags?: number[];
  fandoms?: number[];
  countries?: number[];
  exclude_genres?: number[];
  exclude_tags?: number[];
  exclude_fandoms?: number[];
  min_chapters?: number | "";
  max_chapters?: number | "";
  order?: string;
  adult_content?: boolean;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function normalizeMetaList(raw: unknown): BookMetaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = Number(o.id);
      const name = String(o.name ?? "");
      if (Number.isNaN(id) || !name) return null;
      return { id, name };
    })
    .filter((item): item is BookMetaItem => item != null);
}

function normalizeCountry(raw: unknown): BookCountry | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const name = String(o.name ?? "");
  if (Number.isNaN(id) || !name) return null;
  return { id, name };
}

function normalizeBook(raw: unknown): UserTranslationBook | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const owner = Number(o.owner ?? o.ownerId ?? 0);
  const title = String(o.title ?? "");
  const slug = String(o.slug ?? "");
  if (Number.isNaN(id) || !title) return null;

  return {
    id,
    owner: Number.isNaN(owner) ? 0 : owner,
    ownerId: Number.isNaN(owner) ? 0 : owner,
    title,
    slug,
    image: o.image != null && o.image !== "" ? String(o.image) : null,
    created_at: o.created_at != null && o.created_at !== "" ? String(o.created_at) : null,
    last_updated: o.last_updated != null && o.last_updated !== "" ? String(o.last_updated) : null,
    daily_income: o.daily_income != null ? Number(o.daily_income) : 0,
    monthly_income: o.monthly_income != null ? Number(o.monthly_income) : 0,
    daily_views: o.daily_views != null ? Number(o.daily_views) : 0,
    chapters_count: o.chapters_count != null ? Number(o.chapters_count) : undefined,
    description: o.description != null && o.description !== "" ? String(o.description) : null,
    adult_content: o.adult_content === true,
    translation_status_display:
      o.translation_status_display != null && o.translation_status_display !== ""
        ? String(o.translation_status_display)
        : null,
    bookmark_status:
      o.bookmark_status === "reading" ||
      o.bookmark_status === "dropped" ||
      o.bookmark_status === "planned" ||
      o.bookmark_status === "completed"
        ? o.bookmark_status
        : null,
    bookmark_id:
      o.bookmark_id != null && Number.isFinite(Number(o.bookmark_id))
        ? Number(o.bookmark_id)
        : null,
    country: normalizeCountry(o.country),
    genres: normalizeMetaList(o.genres),
    tags: normalizeMetaList(o.tags),
    fandoms: normalizeMetaList(o.fandoms),
    book_type: o.book_type != null && o.book_type !== "" ? String(o.book_type) : null,
  };
}

function buildParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();

  const title = filters.title?.trim();
  if (title) p.append("title", title);

  const appendMany = (key: string, arr?: number[]) => {
    if (!arr || arr.length === 0) return;
    for (const v of arr) p.append(key, String(v));
  };

  appendMany("genres", filters.genres);
  appendMany("tags", filters.tags);
  appendMany("fandoms", filters.fandoms);
  appendMany("countries", filters.countries);

  appendMany("exclude_genres", filters.exclude_genres);
  appendMany("exclude_tags", filters.exclude_tags);
  appendMany("exclude_fandoms", filters.exclude_fandoms);

  if (filters.min_chapters !== "" && filters.min_chapters != null) {
    p.append("min_chapters", String(filters.min_chapters));
  }
  if (filters.max_chapters !== "" && filters.max_chapters != null) {
    p.append("max_chapters", String(filters.max_chapters));
  }

  if (filters.order) p.append("order", filters.order);

  if (filters.adult_content !== undefined) {
    p.append("adult_content", String(filters.adult_content));
  }

  return p;
}

export async function searchBooks(filters: SearchFilters): Promise<UserTranslationBook[]> {
  const params = buildParams(filters);
  const query = params.toString();
  const url = query ? `${API.bookSearch}?${query}` : API.bookSearch;

  const { data } = await http.get<Paginated<unknown> | unknown[]>(url);

  const list = Array.isArray(data)
    ? data
    : (Array.isArray((data as Paginated<unknown>).results) ? (data as Paginated<unknown>).results : []);

  return list.map(normalizeBook).filter((book): book is UserTranslationBook => book != null);
}

