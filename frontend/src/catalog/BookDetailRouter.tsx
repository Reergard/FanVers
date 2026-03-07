import { useEffect, useLayoutEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { catalogApi, type Book, type Chapter, type Volume } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import BookDetailOwner from "./BookDetailOwner";
import BookDetailReader from "./BookDetailReader";
import BookDetailSkeleton from "./BookDetailSkeleton";
import { AxiosError } from "axios";

const STALE_TIME = 2 * 60_000;

export default function BookDetailRouter() {
  const { slug = "" } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccessAutoClose } = useNotification();
  const { isAuthenticated, userId, authReady } = useAuth();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (location.state?.chapterCreated === true) {
      showSuccessAutoClose("Глава успішно завантажена");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.chapterCreated, location.pathname, navigate, showSuccessAutoClose]);

  useEffect(() => {
    if (location.state?.chapterUpdated === true) {
      showSuccessAutoClose("Розділ успішно оновлено");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.chapterUpdated, location.pathname, navigate, showSuccessAutoClose]);

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

  if (bookQ.isLoading) return <BookDetailSkeleton />;

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
  const chaptersData = chaptersQ.data;
  const chapters: Chapter[] = chaptersData?.chapters ?? [];
  const containerVersions = chaptersData?.container_versions ?? {};
  const ownerId = book.ownerId ?? book.owner;

  if (!authReady) {
    return <BookDetailSkeleton />;
  }

  const isOwner =
    isAuthenticated &&
    userId != null &&
    ownerId !== undefined &&
    ownerId === userId;

  if (isOwner) {
    return (
      <BookDetailOwner
        book={book as Book}
        volumes={volumes}
        chapters={chapters}
        containerVersions={containerVersions}
        chaptersLoading={chaptersQ.isLoading}
        volumesLoading={volumesQ.isLoading}
      />
    );
  }

  return (
    <BookDetailReader
      book={book as Book}
      volumes={volumes}
      chapters={chapters}
      chaptersLoading={chaptersQ.isLoading}
      volumesLoading={volumesQ.isLoading}
    />
  );
}
