import { http } from "./http";
import type { BookAccessRights, PermissionLevel } from "../catalog/settings/accessRights.types";

const CATALOG = "/api/catalog";

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
  /** Відсутній у скорочених DTO (напр. список ТОПу), доки не завантажена повна книга */
  owner?: number;
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
  translation_status?: string | null;
  /** Статус випуску, напр. "Виходить" (API: original_status_display) */
  original_status_display?: string | null;
  original_status?: string | null;
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
  title_en?: string | null;
  /** Ім'я власника (API: owner_username) */
  owner_username?: string | null;
  /** Ім'я творця/перекладача (API: creator_username) */
  creator_username?: string | null;
  /** Статус закладки поточного користувача (API: bookmark_status) */
  bookmark_status?: "reading" | "dropped" | "planned" | "completed" | null;
  /** ID закладки поточного користувача (API: bookmark_id) */
  bookmark_id?: number | null;
  /** Рейтинг твору (майбутнє API) */
  ratingValue?: number | null;
  ratingCount?: number | null;
  thankAuthorCoins?: number | null;
  /** Права доступу (з books/info/) */
  view_permission?: "all" | "bookmarked" | "none";
  comment_book_permission?: "all" | "bookmarked" | "none";
  comment_chapter_permission?: "all" | "bookmarked" | "none";
  download_permission?: "all" | "bookmarked" | "none";
  rate_permission?: PermissionLevel;
}

export type { BookAccessRights };

/** Книга з user-translations API (з додатковою статистикою) */
export interface UserTranslationBook extends Book {
  created_at?: string | null;
  last_updated?: string | null;
  daily_income?: number;
  monthly_income?: number;
  daily_views?: number;
}

/** Книга зі списку покинутих перекладів */
export interface AbandonedTranslationBook extends Book {
  created_at?: string | null;
  last_updated?: string | null;
}

export interface Chapter {
  id: number;
  slug?: string;
  title: string;
  /** Порядок з backend (order). Єдине джерело правди. */
  order: number;
  /** @deprecated Використовуйте order */
  position?: number;
  volume?: number | null;
  volumeId?: number | null;
  volume_title?: string | null;
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
  order?: number;
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

type PaginatedResponse<T> = {
  results?: T[];
  next?: string | null;
};

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

/** Завжди повертає number — для owner/ownerId з API (може бути number або {id: number}). */
function toOwnerId(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    return typeof id === "number" && Number.isFinite(id) ? id : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBook(raw: Record<string, unknown>): Book {
  const genresRaw = Array.isArray(raw.genres) ? raw.genres : [];
  const tagsRaw = Array.isArray(raw.tags) ? raw.tags : [];
  const fandomsRaw = Array.isArray(raw.fandoms) ? raw.fandoms : [];

  const ownerId = toOwnerId(raw.ownerId ?? raw.owner ?? raw.owner_id);

  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    owner: ownerId,
    ownerId,
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
    translation_status:
      raw.translation_status != null && raw.translation_status !== ""
        ? String(raw.translation_status)
        : null,
    original_status_display:
      raw.original_status_display != null && raw.original_status_display !== ""
        ? String(raw.original_status_display)
        : null,
    original_status:
      raw.original_status != null && raw.original_status !== ""
        ? String(raw.original_status)
        : null,
    country: normalizeCountry(raw.country),
    genres: genresRaw.map(normalizeMetaItem).filter((g): g is BookMetaItem => g != null),
    tags: tagsRaw.map(normalizeMetaItem).filter((t): t is BookMetaItem => t != null),
    fandoms: fandomsRaw.map(normalizeMetaItem).filter((f): f is BookMetaItem => f != null),
    book_type: raw.book_type != null && raw.book_type !== "" ? String(raw.book_type) : null,
    title_en: raw.title_en != null && raw.title_en !== "" ? String(raw.title_en) : null,
    owner_username:
      raw.owner_username != null && raw.owner_username !== ""
        ? String(raw.owner_username)
        : null,
    creator_username:
      raw.creator_username != null && raw.creator_username !== ""
        ? String(raw.creator_username)
        : null,
    bookmark_status:
      raw.bookmark_status === "reading" ||
      raw.bookmark_status === "dropped" ||
      raw.bookmark_status === "planned" ||
      raw.bookmark_status === "completed"
        ? raw.bookmark_status
        : null,
    bookmark_id:
      raw.bookmark_id != null && Number.isFinite(Number(raw.bookmark_id))
        ? Number(raw.bookmark_id)
        : null,
    view_permission: toPermissionLevel(raw.view_permission),
    comment_book_permission: toPermissionLevel(raw.comment_book_permission),
    comment_chapter_permission: toPermissionLevel(raw.comment_chapter_permission),
    download_permission: toPermissionLevel(raw.download_permission),
    rate_permission: toPermissionLevel(raw.rate_permission),
  };
}

function toPermissionLevel(raw: unknown): PermissionLevel | undefined {
  if (raw === "all" || raw === "bookmarked" || raw === "none") return raw;
  return undefined;
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

function normalizeAbandonedTranslation(raw: Record<string, unknown>): AbandonedTranslationBook {
  const book = normalizeBook(raw);
  return {
    ...book,
    created_at: raw.created_at != null && raw.created_at !== "" ? String(raw.created_at) : null,
    last_updated: raw.last_updated != null && raw.last_updated !== "" ? String(raw.last_updated) : null,
  };
}

function normalizeChapter(raw: Record<string, unknown>): Chapter {
  const pos = raw.order ?? raw.position ?? raw._position;
  const priceVal = raw.price;
  const orderVal = typeof pos === "number" ? pos : Number(pos ?? 1);
  return {
    id: Number(raw.id),
    slug: raw.slug != null ? String(raw.slug) : undefined,
    title: String(raw.title ?? ""),
    order: orderVal,
    position: orderVal,
    volumeId: raw.volume != null ? Number(raw.volume) : null,
    volume: raw.volume != null ? Number(raw.volume) : null,
    volume_title: raw.volume_title != null ? String(raw.volume_title) : null,
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
    order: raw.order != null ? Number(raw.order) : undefined,
    position: raw.position != null ? Number(raw.position) : undefined,
  };
}

async function fetchAllMetaPages<T>(
  firstUrl: string,
  normalize: (item: unknown) => T | null
): Promise<T[]> {
  const out: T[] = [];
  const seenUrls = new Set<string>();
  let nextUrl: string | null = firstUrl;

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) break;
    seenUrls.add(nextUrl);

    const { data } = await http.get<unknown>(nextUrl);

    if (Array.isArray(data)) {
      out.push(...data.map(normalize).filter((item): item is T => item != null));
      break;
    }

    if (data != null && typeof data === "object") {
      const page = data as PaginatedResponse<unknown>;
      const results = Array.isArray(page.results) ? page.results : [];
      out.push(...results.map(normalize).filter((item): item is T => item != null));
      nextUrl = typeof page.next === "string" && page.next !== "" ? page.next : null;
      continue;
    }

    break;
  }

  return out;
}

// --- Query keys (единая кэш-логика) ---

export const catalogKeys = {
  allBooks: () => ["catalog-all-books"] as const,
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
  abandonedTranslations: () => ["abandoned-translations"] as const,
};

// --- API методы ---

export async function getBook(slug: string): Promise<Book> {
  const { data } = await http.get<Record<string, unknown>>(
    `${CATALOG}/books/info/${encodeURIComponent(slug)}/`
  );
  return normalizeBook(data);
}

/** Права доступу — отримуються з books/info/ (ті ж дані, що й у getBook) */
export async function getBookAccessRights(slug: string): Promise<BookAccessRights> {
  const book = await getBook(slug);
  return {
    view_permission: book.view_permission ?? "all",
    comment_book_permission: book.comment_book_permission ?? "all",
    comment_chapter_permission: book.comment_chapter_permission ?? "all",
    download_permission: book.download_permission ?? "all",
    rate_permission: book.rate_permission ?? "all",
  };
}

/** Оновлення прав доступу (PATCH). Backend повертає { message, updated_fields }, не об'єкт прав. */
export async function updateBookAccessRights(
  slug: string,
  payload: BookAccessRights
): Promise<BookAccessRights> {
  await http.patch(
    `${CATALOG}/books/${encodeURIComponent(slug)}/access-rights/`,
    payload
  );
  return payload;
}

export interface ChaptersResponse {
  chapters: Chapter[];
  container_versions: Record<string, number>;
  volumes?: Volume[];
}

export async function getChapters(slug: string): Promise<ChaptersResponse> {
  const { data } = await http.get<{
    chapters?: unknown[];
    container_versions?: Record<string, number>;
    volumes?: unknown[];
  } | unknown[]>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/chapters/`
  );
  if (data && typeof data === "object" && "chapters" in data && Array.isArray(data.chapters)) {
    const volumes = Array.isArray(data.volumes)
      ? data.volumes.map((v) => normalizeVolume(v as Record<string, unknown>))
      : undefined;
    return {
      chapters: data.chapters.map((c) => normalizeChapter(c as Record<string, unknown>)),
      container_versions: (data.container_versions as Record<string, number>) ?? {},
      volumes,
    };
  }
  const arr = Array.isArray(data) ? data : [];
  return {
    chapters: arr.map((c) => normalizeChapter(c as Record<string, unknown>)),
    container_versions: {},
  };
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

/** Видалення розділу (тільки власник книги) */
export async function deleteChapter(bookSlug: string, chapterId: number): Promise<void> {
  await http.delete(
    `${CATALOG}/books/${encodeURIComponent(bookSlug)}/chapters/${chapterId}/delete/`
  );
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

export interface ReorderChaptersResponse {
  volume_id: number | null;
  container_version: number;
  chapters: { id: number; order: number }[];
}

export interface ReorderChaptersConflictResponse {
  detail: string;
  container_version: number;
  chapters: { id: number; order: number }[];
}

export interface MoveChapterResponse {
  chapters: Chapter[];
  container_versions: Record<string, number>;
}

/** Перемістити розділ в інший том або "без тому". */
export async function moveChapter(
  bookSlug: string,
  chapterId: number,
  toVolumeId: number | null,
  toOrder?: number
): Promise<MoveChapterResponse> {
  const { data } = await http.post<{ chapters: unknown[]; container_versions: Record<string, number> }>(
    `${CATALOG}/books/${encodeURIComponent(bookSlug)}/chapters/${chapterId}/move/`,
    {
      to_volume_id: toVolumeId,
      ...(toOrder != null && toOrder >= 1 && { to_order: toOrder }),
    }
  );
  return {
    chapters: Array.isArray(data.chapters)
      ? data.chapters.map((c) => normalizeChapter(c as Record<string, unknown>))
      : [],
    container_versions: data.container_versions ?? {},
  };
}

/** Reorder глав в контейнері. Єдиний endpoint для зміни порядку. */
export async function reorderChapters(
  bookSlug: string,
  volumeId: number | null,
  orderedIds: number[],
  containerVersion?: number
): Promise<ReorderChaptersResponse> {
  const { data } = await http.post<ReorderChaptersResponse>(
    `${CATALOG}/books/${encodeURIComponent(bookSlug)}/chapters/reorder/`,
    {
      volume_id: volumeId,
      ordered_ids: orderedIds,
      ...(containerVersion != null && { container_version: containerVersion }),
    }
  );
  return data;
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

/** Усі книги каталогу (без фільтрації по користувачу/типу) */
export async function getAllCatalogBooks(): Promise<UserTranslationBook[]> {
  const { data } = await http.get<Record<string, unknown>[]>(
    `${CATALOG}/books/reader/`
  );
  return Array.isArray(data) ? data.map(normalizeUserTranslation) : [];
}

/** Список покинутих перекладів */
export async function getAbandonedTranslations(): Promise<AbandonedTranslationBook[]> {
  const { data } = await http.get<Record<string, unknown>[]>(
    `${CATALOG}/abandoned-translations/`
  );
  return Array.isArray(data) ? data.map(normalizeAbandonedTranslation) : [];
}

// --- Справочники для сторінки створення книги ---

const STALE_REF = 10 * 60 * 1000; // 10 хв

export async function getGenres(): Promise<BookMetaItem[]> {
  return fetchAllMetaPages(`${CATALOG}/genres/`, normalizeMetaItem);
}

export async function getTags(): Promise<TagWithGroup[]> {
  return fetchAllMetaPages(`${CATALOG}/tags/`, normalizeTagWithGroup);
}

export async function getCountries(): Promise<BookCountry[]> {
  return fetchAllMetaPages(`${CATALOG}/countries/`, normalizeCountry);
}

export async function getFandoms(): Promise<BookMetaItem[]> {
  return fetchAllMetaPages(`${CATALOG}/fandoms/`, normalizeMetaItem);
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

export interface UpdateBookPayload {
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

export async function updateBook(slug: string, payload: UpdateBookPayload): Promise<Book> {
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

  const { data } = await http.put<Record<string, unknown>>(
    `${CATALOG}/books/${encodeURIComponent(slug)}/update/`,
    form
  );

  return normalizeBook(data);
}

export const catalogApi = {
  getBook,
  getBookAccessRights,
  updateBookAccessRights,
  getChapters,
  getVolumes,
  getChapterDetail,
  deleteChapter,
  getChapterNavigation,
  createVolume,
  reorderChapters,
  moveChapter,
  uploadChapter,
  getAllCatalogBooks,
  getUserTranslations,
  getAbandonedTranslations,
  getGenres,
  getTags,
  getCountries,
  getFandoms,
  createBook,
  updateBook,
};

export { STALE_REF };
