import { http } from "./http";

const CATALOG = "/api/catalog";
const EDITORS = "/api/editors";

// --- Контракты данных (минимальные поля для Router/Owner/Reader) ---

/** Элемент з API: жанр, тег, фендом — має id і name */
export interface BookMetaItem {
  id: number;
  name: string;
}

/** Тег з групою (API tags повертає group при depth=1) */
export interface TagWithGroup extends BookMetaItem {
  group?: { id: number; name: string } | null;
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

/** Книга з user-translations API (з додатковою статистикою) */
export interface UserTranslationBook extends Book {
  created_at?: string | null;
  last_updated?: string | null;
  daily_income?: number;
  monthly_income?: number;
  daily_views?: number;
}

export interface Chapter {
  id: number;
  slug?: string;
  title: string;
  position: number;
  volume?: number | null;
  volumeId?: number | null;
  /** Платний розділ (з API) */
  is_paid?: boolean;
  /** Чи купив поточний користувач цей розділ */
  is_purchased?: boolean;
  /** Ціна (з API), для безкоштовних — 0 */
  price?: number;
  /** ISO дата створення з API */
  created_at?: string | null;
}

export interface Volume {
  id: number;
  title: string;
  book?: number;
  position?: number;
}

export interface ChapterDetail {
  id: number;
  slug: string;
  title: string;
  content: string;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_owner_id: number | null;
  is_paid: boolean;
  price: number | null;
}

export interface ChapterNavigationItem {
  id: number;
  slug: string;
  title: string;
  is_paid: boolean;
  is_purchased: boolean;
  volume: number | null;
}

export interface ChapterNavigation {
  current_chapter: ChapterNavigationItem | null;
  prev_chapter: ChapterNavigationItem | null;
  next_chapter: ChapterNavigationItem | null;
  all_chapters: ChapterNavigationItem[];
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

function normalizeTagWithGroup(item: unknown): TagWithGroup | null {
  const base = normalizeMetaItem(item);
  if (!base) return null;
  const o = item as Record<string, unknown>;
  const g = o.group;
  let group: { id: number; name: string } | undefined;
  if (g != null && typeof g === "object" && "id" in g && "name" in g) {
    const gid = Number((g as Record<string, unknown>).id);
    const gname = String((g as Record<string, unknown>).name ?? "");
    if (!Number.isNaN(gid) && gname) group = { id: gid, name: gname };
  }
  return { ...base, group: group ?? null };
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

function normalizeUserTranslation(raw: Record<string, unknown>): UserTranslationBook {
  const book = normalizeBook(raw);
  return {
    ...book,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    last_updated: raw.last_updated != null ? String(raw.last_updated) : null,
    daily_income: raw.daily_income != null ? Number(raw.daily_income) : 0,
    monthly_income: raw.monthly_income != null ? Number(raw.monthly_income) : 0,
    daily_views: raw.daily_views != null ? Number(raw.daily_views) : 0,
  };
}

function normalizeChapter(raw: Record<string, unknown>): Chapter {
  const pos = raw.position ?? raw._position;
  const priceVal = raw.price;
  return {
    id: Number(raw.id),
    slug: raw.slug != null ? String(raw.slug) : undefined,
    title: String(raw.title ?? ""),
    position: typeof pos === "number" ? pos : Number(pos ?? 0),
    volumeId: raw.volume != null ? Number(raw.volume) : null,
    volume: raw.volume != null ? Number(raw.volume) : null,
    is_paid: raw.is_paid === true,
    is_purchased: raw.is_purchased === true,
    price: priceVal != null ? Number(priceVal) : undefined,
    created_at: raw.created_at != null && raw.created_at !== "" ? String(raw.created_at) : null,
  };
}

function normalizeChapterDetail(raw: Record<string, unknown>): ChapterDetail {
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    book_id: Number(raw.book_id ?? raw.book ?? 0),
    book_slug: String(raw.book_slug ?? ""),
    book_title: String(raw.book_title ?? ""),
    book_owner_id: raw.book_owner_id != null ? Number(raw.book_owner_id) : null,
    is_paid: raw.is_paid === true,
    price: raw.price != null ? Number(raw.price) : null,
  };
}

function normalizeChapterNavigationItem(raw: unknown): ChapterNavigationItem | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const slug = String(o.slug ?? "");
  const title = String(o.title ?? "");
  if (Number.isNaN(id) || !slug || !title) return null;
  return {
    id,
    slug,
    title,
    is_paid: o.is_paid === true,
    is_purchased: o.is_purchased === true,
    volume: o.volume != null ? Number(o.volume) : null,
  };
}

function normalizeChapterNavigation(raw: Record<string, unknown>): ChapterNavigation {
  const current = normalizeChapterNavigationItem(raw.current_chapter);
  const prev = normalizeChapterNavigationItem(raw.prev_chapter);
  const next = normalizeChapterNavigationItem(raw.next_chapter);
  const allRaw = Array.isArray(raw.all_chapters) ? raw.all_chapters : [];
  return {
    current_chapter: current,
    prev_chapter: prev,
    next_chapter: next,
    all_chapters: allRaw
      .map(normalizeChapterNavigationItem)
      .filter((item): item is ChapterNavigationItem => item != null),
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
  chapterDetail: (bookSlug: string, chapterSlug: string) =>
    ["chapter-detail", bookSlug, chapterSlug] as const,
  chapterNavigation: (bookSlug: string, chapterSlug: string) =>
    ["chapter-navigation", bookSlug, chapterSlug] as const,
  chaptersPage: (bookId: number, rangeStart: number) =>
    ["book-chapters-page", bookId, rangeStart] as const,
  userTranslations: (userId: number) => ["user-translations", userId] as const,
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

export async function getChapterDetail(
  bookSlug: string,
  chapterSlug: string
): Promise<ChapterDetail> {
  const { data } = await http.get<Record<string, unknown>>(
    `${CATALOG}/books/${encodeURIComponent(bookSlug)}/chapters/${encodeURIComponent(chapterSlug)}/`
  );
  const normalized = normalizeChapterDetail(data);
  if (!normalized.book_slug) {
    normalized.book_slug = bookSlug;
  }
  if (!normalized.slug) {
    normalized.slug = chapterSlug;
  }
  return normalized;
}

export async function getChapterNavigation(
  bookSlug: string,
  chapterSlug: string
): Promise<ChapterNavigation> {
  const { data } = await http.get<Record<string, unknown>>(
    `/api/navigation/books/${encodeURIComponent(bookSlug)}/chapters/${encodeURIComponent(chapterSlug)}/navigation/`
  );
  return normalizeChapterNavigation(data);
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

/**
 * Завантаження розділу (глави): multipart/form-data.
 * @param volumeId — id тому або null (не прив’язувати до тому)
 * @param price — число (для платних глав; для безкоштовних бекенд ставить 0)
 */
export async function uploadChapter(
  slug: string,
  title: string,
  file: File,
  isPaid: boolean,
  volumeId: number | null,
  price: number
): Promise<Chapter> {
  const form = new FormData();
  form.append("title", title.trim());
  form.append("file", file);
  form.append("is_paid", isPaid ? "true" : "false");
  if (volumeId != null) {
    form.append("volume", String(volumeId));
  }
  form.append("price", String(price));

  const { data } = await http.post<Record<string, unknown>>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/add_chapter/`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return normalizeChapter(data);
}

/** Книги користувача (власні переклади та авторські твори) */
export async function getUserTranslations(): Promise<UserTranslationBook[]> {
  const { data } = await http.get<Record<string, unknown>[]>(
    `${CATALOG}/user-translations/`
  );
  return Array.isArray(data) ? data.map(normalizeUserTranslation) : [];
}

// --- Справочники для сторінки створення книги ---

const STALE_REF = 10 * 60 * 1000; // 10 хв

export async function getGenres(): Promise<BookMetaItem[]> {
  const { data } = await http.get<Record<string, unknown>[]>(`${CATALOG}/genres/`);
  return Array.isArray(data) ? data.map(normalizeMetaItem).filter((g): g is BookMetaItem => g != null) : [];
}

export async function getTags(): Promise<TagWithGroup[]> {
  const { data } = await http.get<Record<string, unknown>[]>(`${CATALOG}/tags/`);
  return Array.isArray(data) ? data.map(normalizeTagWithGroup).filter((t): t is TagWithGroup => t != null) : [];
}

export async function getCountries(): Promise<BookCountry[]> {
  const { data } = await http.get<Record<string, unknown>[]>(`${CATALOG}/countries/`);
  return Array.isArray(data) ? data.map(normalizeCountry).filter((c): c is BookCountry => c != null) : [];
}

export async function getFandoms(): Promise<BookMetaItem[]> {
  const { data } = await http.get<Record<string, unknown>[]>(`${CATALOG}/fandoms/`);
  return Array.isArray(data) ? data.map(normalizeMetaItem).filter((f): f is BookMetaItem => f != null) : [];
}

/** Payload для створення книги. image — File або null. */
export interface CreateBookPayload {
  title: string;
  title_en?: string;
  author: string;
  description?: string;
  book_type: "AUTHOR" | "TRANSLATION";
  translation_status?: string | null;
  original_status: string;
  country: number;
  genres: number[];
  tags: number[];
  fandoms: number[];
  adult_content: boolean;
  image?: File | null;
}

/** Відповідь створення книги (повна книга з бекенду). */
export interface CreateBookResponse {
  id: number;
  slug: string;
  title: string;
  [key: string]: unknown;
}

/** Створення книги: multipart/form-data (backend очікує getlist для genres/tags/fandoms). */
export async function createBook(payload: CreateBookPayload): Promise<CreateBookResponse> {
  const form = new FormData();
  form.append("title", payload.title.trim());
  if (payload.title_en != null && payload.title_en.trim() !== "") {
    form.append("title_en", payload.title_en.trim());
  }
  form.append("author", payload.author.trim());
  if (payload.description != null && payload.description.trim() !== "") {
    form.append("description", payload.description.trim());
  }
  form.append("book_type", payload.book_type);
  form.append("original_status", payload.original_status);
  form.append("country", String(payload.country));
  payload.genres.forEach((id) => form.append("genres", String(id)));
  payload.tags.forEach((id) => form.append("tags", String(id)));
  payload.fandoms.forEach((id) => form.append("fandoms", String(id)));
  form.append("adult_content", payload.adult_content ? "true" : "false");
  if (payload.book_type === "TRANSLATION" && payload.translation_status != null) {
    form.append("translation_status", payload.translation_status);
  }
  if (payload.image) {
    form.append("image", payload.image);
  }
  const { data } = await http.post<CreateBookResponse>(`${CATALOG}/books/create/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export const catalogApi = {
  getBook,
  getChapters,
  getVolumes,
  getChapterDetail,
  getChapterNavigation,
  createVolume,
  updateChapterOrder,
  updateChapterOrderNoVolume,
  uploadChapter,
  getUserTranslations,
  getGenres,
  getTags,
  getCountries,
  getFandoms,
  createBook,
};

export { STALE_REF };
