import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { catalogApi, type Book, type Chapter, type Volume } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";
import BookDetailOwner from "./BookDetailOwner";
import BookDetailReader from "./BookDetailReader";
import { AxiosError } from "axios";

const STALE_TIME = 2 * 60_000;

export default function BookDetailRouter() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { isAuthenticated, userId } = useAuth();

  const bookQ = useQuery({
    queryKey: ["book", slug],
    queryFn: () => catalogApi.getBook(slug),
    enabled: Boolean(slug),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const book = bookQ.data;

  const volumesQ = useQuery({
    queryKey: ["book-volumes", slug],
    queryFn: () => catalogApi.getVolumes(slug),
    enabled: Boolean(slug) && Boolean(book),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const chaptersQ = useQuery({
    queryKey: ["book-chapters", slug],
    queryFn: () => catalogApi.getChapters(slug),
    enabled: Boolean(slug) && Boolean(book),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const mode = useMemo<"owner" | "reader" | null>(() => {
    if (!book) return null;
    const ownerId = book.ownerId ?? book.owner;
    const isOwner =
      isAuthenticated && userId != null && ownerId !== undefined && ownerId === userId;
    return isOwner ? "owner" : "reader";
  }, [book, isAuthenticated, userId]);

  if (bookQ.isLoading) return <div>Loading book…</div>;
  if (bookQ.isError) {
    const err = bookQ.error as AxiosError;
    const status = err.response?.status;
    if (status === 404) return <div>Книгу не знайдено</div>;
    if (status === 403)
      return (
        <div>
          Доступ заборонено. <Link to="/">Назад</Link>
        </div>
      );
    return <div>Помилка завантаження</div>;
  }
  if (!book) return <div>Книгу не знайдено</div>;

  const volumes: Volume[] = volumesQ.data ?? [];
  const chapters: Chapter[] = chaptersQ.data ?? [];

  if (mode === "owner") {
    return (
      <BookDetailOwner
        book={book as Book}
        volumes={volumes}
        chapters={chapters}
      />
    );
  }
  return (
    <BookDetailReader
      book={book as Book}
      volumes={volumes}
      chapters={chapters}
    />
  );
}
