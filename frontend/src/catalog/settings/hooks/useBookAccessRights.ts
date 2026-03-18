import { useQuery } from "@tanstack/react-query";
import { catalogApi, catalogKeys } from "../../../api/catalogApi";
import type { BookAccessRights } from "../accessRights.types";

const STALE_TIME = 5 * 60 * 1000;

function extractAccessRights(book: { view_permission?: string; comment_book_permission?: string; comment_chapter_permission?: string; download_permission?: string; rate_permission?: string }): BookAccessRights {
  const def = "all" as const;
  return {
    view_permission: (book.view_permission === "all" || book.view_permission === "bookmarked" || book.view_permission === "none") ? book.view_permission : def,
    comment_book_permission: (book.comment_book_permission === "all" || book.comment_book_permission === "bookmarked" || book.comment_book_permission === "none") ? book.comment_book_permission : def,
    comment_chapter_permission: (book.comment_chapter_permission === "all" || book.comment_chapter_permission === "bookmarked" || book.comment_chapter_permission === "none") ? book.comment_chapter_permission : def,
    download_permission: (book.download_permission === "all" || book.download_permission === "bookmarked" || book.download_permission === "none") ? book.download_permission : def,
    rate_permission: (book.rate_permission === "all" || book.rate_permission === "bookmarked" || book.rate_permission === "none") ? book.rate_permission : def,
  };
}

/** Використовує кеш книги (catalogKeys.book) — не дублює запит, якщо useBookBySlug вже завантажив книгу. */
export function useBookAccessRights(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? catalogKeys.book(slug) : ["book-access-rights-empty"],
    queryFn: () => catalogApi.getBook(slug!),
    enabled: !!slug,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    select: extractAccessRights,
  });
}
