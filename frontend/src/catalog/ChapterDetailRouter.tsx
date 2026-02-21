import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { catalogApi, catalogKeys } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";
import { Modal } from "../shared/Modal/Modal";
import ChapterDetail from "./ChapterDetail";

const STALE_TIME = 2 * 60_000;

export default function ChapterDetailRouter() {
  const { bookSlug = "", chapterSlug = "" } = useParams<{
    bookSlug: string;
    chapterSlug: string;
  }>();
  const { isAuthenticated, userId, authReady } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [forbiddenModalText, setForbiddenModalText] = useState<string | null>(null);

  const chapterQ = useQuery({
    queryKey: catalogKeys.chapterDetail(bookSlug, chapterSlug),
    queryFn: () => catalogApi.getChapterDetail(bookSlug, chapterSlug),
    enabled: Boolean(bookSlug) && Boolean(chapterSlug) && authReady,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const navigationQ = useQuery({
    queryKey: catalogKeys.chapterNavigation(bookSlug, chapterSlug),
    queryFn: () => catalogApi.getChapterNavigation(bookSlug, chapterSlug),
    enabled: Boolean(bookSlug) && Boolean(chapterSlug) && !chapterQ.isError && authReady,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const handleNavigateToChapter = useCallback(
    async (targetChapterSlug: string) => {
      try {
        await qc.fetchQuery({
          queryKey: catalogKeys.chapterDetail(bookSlug, targetChapterSlug),
          queryFn: () => catalogApi.getChapterDetail(bookSlug, targetChapterSlug),
          staleTime: STALE_TIME,
        });
        navigate(`/books/${bookSlug}/chapters/${targetChapterSlug}`);
      } catch (error) {
        const err = error as AxiosError<{ error?: string; detail?: string }>;
        if (err.response?.status === 403) {
          setForbiddenModalText(err.response?.data?.error ?? "Необхідно придбати главу для перегляду");
          return;
        }
      }
    },
    [bookSlug, navigate, qc]
  );

  if (!authReady || chapterQ.isLoading) {
    return <div>Завантаження розділу...</div>;
  }

  if (chapterQ.isError) {
    const err = chapterQ.error as AxiosError<{ error?: string; detail?: string }>;
    const status = err.response?.status;
    const errorText = err.response?.data?.error ?? err.response?.data?.detail;
    if (status === 404) return <div>Розділ не знайдено</div>;
    if (status === 403) return <div>{errorText ?? "Доступ до розділу заборонено"}</div>;
    return <div>Помилка завантаження розділу</div>;
  }

  const chapter = chapterQ.data;
  if (!chapter) return <div>Розділ не знайдено</div>;

  const navigation = navigationQ.data;
  const resolvedBookSlug = chapter.book_slug || bookSlug;
  const isOwner =
    isAuthenticated &&
    userId != null &&
    chapter.book_owner_id != null &&
    chapter.book_owner_id === userId;

  return (
    <>
      <p style={{ margin: "12px 0 0 0" }}>
        <Link to={`/books/${resolvedBookSlug}`}>До книги: {chapter.book_title || "Повернутися до книги"}</Link>
      </p>
      <ChapterDetail
        bookSlug={resolvedBookSlug}
        chapterSlug={chapter.slug || chapterSlug}
        chapterTitle={chapter.title}
        chapterContentHtml={chapter.content}
        prevChapterSlug={navigation?.prev_chapter?.slug ?? null}
        nextChapterSlug={navigation?.next_chapter?.slug ?? null}
        isOwner={isOwner}
        onNavigateToChapter={handleNavigateToChapter}
      />
      <Modal
        open={forbiddenModalText != null}
        onClose={() => setForbiddenModalText(null)}
        title="Увага"
      >
        <p>{forbiddenModalText}</p>
      </Modal>
    </>
  );
}
