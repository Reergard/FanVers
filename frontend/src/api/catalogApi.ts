import { http } from "./http";

const CATALOG = "/api/catalog";
const EDITORS = "/api/editors";

// --- Контракты данных (минимальные поля для Router/Owner/Reader) ---

/** Элемент з API: жанр, тег, фендом — має id і name */
export interface BookMetaItem {
  id: number;
  name: string;
}

/** Країна з API */
export interface BookCountry {
  id: number;
  name: string;
}

export interface Book {
  id: number;
  slug: string;
  title: string;
  owner: number;
  ownerId?: number;
  isPublic?: boolean;
  chapters_count?: number;
  description?: string | null;
  titleSecondary?: string | null;
  /** URL обкладинки з БД (API: image) */
  image?: string | null;
  /** Автор твору (API: author) */
  author?: string | null;
  /** 18+ (API: adult_content) */
  adult_content?: boolean;
  /** Статус перекладу, напр. "Перекладається" (API: translation_status_display) */
  translation_status_display?: string | null;
  /** Статус випуску, напр. "Виходить" (API: original_status_display) */
  original_status_display?: string | null;
  /** Країна (API: country) */
  country?: BookCountry | null;
  /** Жанри (API: genres) */
  genres?: BookMetaItem[];
  /** Теги (API: tags) */
  tags?: BookMetaItem[];
  /** Фендоми (API: fandoms) */
  fandoms?: BookMetaItem[];
  /** Тип: AUTHOR | TRANSLATION (API: book_type) */
  book_type?: string | null;
  /** Ім'я власника (API: owner_username) */
  owner_username?: string | null;
  /** Ім'я творця/перекладача (API: creator_username) */
  creator_username?: string | null;
  /** Рейтинг твору (майбутнє API) */
  ratingValue?: number | null;
  ratingCount?: number | null;
  thankAuthorCoins?: number | null;
}

export interface Chapter {
  id: number;
  title: string;
  position: number;
  volume?: number | null;
  volumeId?: number | null;
}

export interface Volume {
  id: number;
  title: string;
  book?: number;
  position?: number;
}

// --- Нормализация ответов API (бэкенд может отдавать owner, фронт использует ownerId) ---

function normalizeMetaItem(item: unknown): BookMetaItem | null {
  if (item == null || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = o.id != null ? Number(o.id) : NaN;
  const name = typeof o.name === "string" ? o.name : "";
  if (Number.isNaN(id) || !name) return null;
  return { id, name };
}

function normalizeCountry(raw: unknown): BookCountry | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? Number(o.id) : NaN;
  const name = typeof o.name === "string" ? o.name : "";
  if (Number.isNaN(id) || !name) return null;
  return { id, name };
}

function normalizeBook(raw: Record<string, unknown>): Book {
  const genresRaw = Array.isArray(raw.genres) ? raw.genres : [];
  const tagsRaw = Array.isArray(raw.tags) ? raw.tags : [];
  const fandomsRaw = Array.isArray(raw.fandoms) ? raw.fandoms : [];

  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    owner: Number((raw.ownerId ?? raw.owner) ?? 0),
    ownerId: Number((raw.ownerId ?? raw.owner) ?? 0),
    isPublic: raw.view_permission !== undefined ? raw.view_permission === "PUBLIC" : undefined,
    chapters_count: raw.chapters_count != null ? Number(raw.chapters_count) : undefined,
    description:
      raw.description != null && raw.description !== ""
        ? String(raw.description)
        : null,
    titleSecondary:
      raw.title_en != null && raw.title_en !== ""
        ? String(raw.title_en)
        : null,
    image: raw.image != null && raw.image !== "" ? String(raw.image) : null,
    author: raw.author != null && raw.author !== "" ? String(raw.author) : null,
    adult_content: raw.adult_content === true,
    translation_status_display:
      raw.translation_status_display != null && raw.translation_status_display !== ""
        ? String(raw.translation_status_display)
        : null,
    original_status_display:
      raw.original_status_display != null && raw.original_status_display !== ""
        ? String(raw.original_status_display)
        : null,
    country: normalizeCountry(raw.country),
    genres: genresRaw.map(normalizeMetaItem).filter((g): g is BookMetaItem => g != null),
    tags: tagsRaw.map(normalizeMetaItem).filter((t): t is BookMetaItem => t != null),
    fandoms: fandomsRaw.map(normalizeMetaItem).filter((f): f is BookMetaItem => f != null),
    book_type: raw.book_type != null && raw.book_type !== "" ? String(raw.book_type) : null,
    owner_username:
      raw.owner_username != null && raw.owner_username !== ""
        ? String(raw.owner_username)
        : null,
    creator_username:
      raw.creator_username != null && raw.creator_username !== ""
        ? String(raw.creator_username)
        : null,
  };
}

function normalizeChapter(raw: Record<string, unknown>): Chapter {
  const pos = raw.position ?? raw._position;
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    position: typeof pos === "number" ? pos : Number(pos ?? 0),
    volumeId: raw.volume != null ? Number(raw.volume) : null,
    volume: raw.volume != null ? Number(raw.volume) : null,
  };
}

function normalizeVolume(raw: Record<string, unknown>): Volume {
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    book: raw.book != null ? Number(raw.book) : undefined,
    position: raw.position != null ? Number(raw.position) : undefined,
  };
}

// --- Query keys (единая кэш-логика) ---

export const catalogKeys = {
  book: (slug: string) => ["book", slug] as const,
  volumes: (slug: string) => ["book-volumes", slug] as const,
  chapters: (slug: string) => ["book-chapters", slug] as const,
  chaptersPage: (bookId: number, rangeStart: number) =>
    ["book-chapters-page", bookId, rangeStart] as const,
};

// --- API методы ---

export async function getBook(slug: string): Promise<Book> {
  const { data } = await http.get<Record<string, unknown>>(
    `${CATALOG}/books/info/${encodeURIComponent(slug)}/`
  );
  return normalizeBook(data);
}

export async function getChapters(slug: string): Promise<Chapter[]> {
  const { data } = await http.get<Record<string, unknown>[]>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/chapters/`
  );
  return Array.isArray(data) ? data.map(normalizeChapter) : [];
}

export async function getVolumes(slug: string): Promise<Volume[]> {
  const { data } = await http.get<Record<string, unknown>[]>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/volumes/`
  );
  return Array.isArray(data) ? data.map(normalizeVolume) : [];
}

export async function createVolume(slug: string, title: string): Promise<Volume> {
  const { data } = await http.post<Record<string, unknown>>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/create-volume/`,
    { title }
  );
  return normalizeVolume(data);
}

/** Обновление порядка глав в одном томе. Payload: { chapter_id, position }[] */
export async function updateChapterOrder(
  volumeId: number,
  chapterOrders: { chapter_id: number; position: number }[]
): Promise<void> {
  await http.post(`${EDITORS}/volumes/${volumeId}/update-order/`, {
    chapter_orders: chapterOrders,
  });
}

/** Обновление порядка глав без привязки к тому (глобально). */
export async function updateChapterOrderNoVolume(
  chapterOrders: { chapter_id: number; position: number; volume_id?: number | null }[]
): Promise<void> {
  await http.post(`${EDITORS}/chapters/update-order/`, {
    chapter_orders: chapterOrders,
  });
}

export const catalogApi = {
  getBook,
  getChapters,
  getVolumes,
  createVolume,
  updateChapterOrder,
  updateChapterOrderNoVolume,
};
