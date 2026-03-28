import type { Book } from "../catalogApi";
import { resolveIsNewBadge } from "../../shared/bookNewBadge";
import type { BookReaderTopDto } from "./types";

function truncateDescription(text: string | null, max = 200): string {
  if (!text) return "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max).trim()}…`;
}

/**
 * BookReaderSerializer (ТОП) → **Book** для BookCard.
 * `owner` не передаємо: у цьому списку серіалізатор не віддає numeric owner — підставляти 0 небезпечно.
 */
export function mapTopDtoToBook(dto: BookReaderTopDto): Book {
  const bookmark_status = dto.bookmark_status as Book["bookmark_status"];
  const validStatus =
    bookmark_status === "reading" ||
    bookmark_status === "dropped" ||
    bookmark_status === "planned" ||
    bookmark_status === "completed"
      ? bookmark_status
      : null;

  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    description: dto.description,
    title_en: dto.title_en,
    image: dto.image,
    author: dto.author || null,
    adult_content: dto.adult_content,
    translation_status: dto.translation_status,
    translation_status_display: dto.translation_status_display,
    original_status: dto.original_status,
    original_status_display: dto.original_status_display,
    country: dto.country,
    genres: dto.genres,
    tags: dto.tags,
    fandoms: dto.fandoms,
    book_type: dto.book_type,
    owner_username: dto.owner_username,
    creator_username: dto.creator_username,
    bookmark_status: validStatus,
    bookmark_id:
      dto.bookmark_id != null && Number.isFinite(dto.bookmark_id)
        ? dto.bookmark_id
        : null,
    chapters_count: dto.chapters_count,
    created_at: dto.created_at,
    last_updated: dto.last_updated,
    is_new_badge: resolveIsNewBadge(dto.is_new_badge, dto.created_at),
  };
}

/** Підпис під карткою в каруселі ТОПу: опис → статуси → автор → кількість глав */
export function getTopCardCaptionFromBook(book: Book): string {
  const fromDesc = truncateDescription(book.description ?? null, 180);
  if (fromDesc) return fromDesc;

  const t = book.translation_status_display?.trim();
  const o = book.original_status_display?.trim();
  const isTranslation = book.book_type === "TRANSLATION";

  if (isTranslation && t) return t;
  if (!isTranslation && o) return o;
  if (o) return o;
  if (t) return t;

  const author = book.author?.trim();
  if (author) return author;

  const ch = book.chapters_count;
  if (ch != null && ch > 0) return `Розділів: ${ch}`;
  return "";
}
