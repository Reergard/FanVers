/**
 * Нормалізація сирого JSON для **GET /api/analytics_books/top/** (BookReaderSerializer).
 * Не плутати з майбутніми «Трендами» — окремий endpoint.
 */
import { resolveIsNewBadge } from "../../shared/bookNewBadge";
import type {
  BookReaderTopCountry,
  BookReaderTopDto,
  BookReaderTopMeta,
} from "./types";

function asMetaList(v: unknown): BookReaderTopMeta[] {
  if (!Array.isArray(v)) return [];
  const out: BookReaderTopMeta[] = [];
  for (const item of v) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id);
    const name = o.name != null ? String(o.name).trim() : "";
    if (!Number.isFinite(id) || !name) continue;
    out.push({ id, name });
  }
  return out;
}

function asCountry(v: unknown): BookReaderTopCountry | null {
  if (v == null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return { id, name: String(o.name ?? "") };
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** BookReaderSerializer віддає `image`; інші ключі — на випадок сумісності / кастомних відповідей. */
function pickCoverUrl(o: Record<string, unknown>): string | null {
  for (const key of ["image", "cover_url", "cover", "cover_image", "poster"] as const) {
    const v = o[key];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

/** Повертає DTO або null, якщо рядок невалідний (немає slug/id). */
export function normalizeBookReaderTopRow(raw: unknown): BookReaderTopDto | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const slug = o.slug != null ? String(o.slug).trim() : "";
  if (!Number.isFinite(id) || !slug) return null;

  const chaptersRaw = Number(o.chapters_count);
  const chapters_count = Number.isFinite(chaptersRaw) ? chaptersRaw : 0;

  return {
    id,
    slug,
    title: o.title != null ? String(o.title) : "",
    title_en: asString(o.title_en),
    author: o.author != null ? String(o.author) : "",
    description: asString(o.description),
    image: pickCoverUrl(o),
    translation_status: asString(o.translation_status),
    translation_status_display: asString(o.translation_status_display),
    original_status: asString(o.original_status),
    original_status_display: asString(o.original_status_display),
    country: asCountry(o.country),
    last_updated: asString(o.last_updated),
    owner_username: asString(o.owner_username),
    creator_username: asString(o.creator_username),
    bookmark_status: asString(o.bookmark_status),
    bookmark_id: (() => {
      if (o.bookmark_id == null || o.bookmark_id === "") return null;
      const n = Number(o.bookmark_id);
      return Number.isFinite(n) ? n : null;
    })(),
    adult_content: o.adult_content === true,
    book_type: asString(o.book_type),
    chapters_count,
    genres: asMetaList(o.genres),
    tags: asMetaList(o.tags),
    fandoms: asMetaList(o.fandoms),
    created_at: asString(o.created_at),
    is_new_badge: resolveIsNewBadge(o.is_new_badge, asString(o.created_at)),
  };
}
