import { http } from "./http";

const CATALOG = "/api/catalog";
const EDITORS = "/api/editors";

// --- Контракты данных (минимальные поля для Router/Owner/Reader) ---

export interface Book {
  id: number;
  slug: string;
  title: string;
  owner: number;
  ownerId?: number;
  isPublic?: boolean;
  chapters_count?: number;
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

function normalizeBook(raw: Record<string, unknown>): Book {
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    owner: Number((raw.ownerId ?? raw.owner) ?? 0),
    ownerId: Number((raw.ownerId ?? raw.owner) ?? 0),
    isPublic: raw.view_permission !== undefined ? raw.view_permission === "PUBLIC" : undefined,
    chapters_count: raw.chapters_count != null ? Number(raw.chapters_count) : undefined,
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
