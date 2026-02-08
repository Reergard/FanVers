import { http } from "../api/http";
import { API } from "../api/endpoints";
import type {
  BookmarkStatus,
  BookmarkStatusResponse,
  Bookmark,
} from "./types";

/** Отримати статус закладки для книги (null якщо немає) */
export async function getBookmarkStatus(
  bookId: number
): Promise<BookmarkStatusResponse> {
  try {
    const { data } = await http.get<BookmarkStatusResponse>(
      API.bookmarkStatus(bookId)
    );
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return { id: null, status: null };
    }
    throw err;
  }
}

/** Додати закладку (або оновити існуючу — бекенд сам перевіряє) */
export async function addBookmark(
  bookId: number,
  status: BookmarkStatus
): Promise<Bookmark> {
  const { data } = await http.post<Bookmark>(API.bookmarks, {
    book_id: bookId,
    status,
  });
  return data;
}

/** Оновити існуючу закладку */
export async function updateBookmark(
  bookmarkId: number,
  status: BookmarkStatus
): Promise<Bookmark> {
  const { data } = await http.patch<Bookmark>(API.bookmarkById(bookmarkId), {
    status,
  });
  return data;
}

/** Отримати закладки користувача (status: 'all' | reading | dropped | planned | completed) */
export async function getUserBookmarks(
  status: string = "all"
): Promise<Bookmark[]> {
  const url =
    status && status !== "all"
      ? `${API.bookmarks}?status=${status}`
      : API.bookmarks;
  const { data } = await http.get<Bookmark[]>(url);
  return data;
}
