import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { catalogApi, catalogKeys } from "../api/catalogApi";
import type { Book, Chapter, Volume } from "../api/catalogApi";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { MoveChapterModal } from "./sections/MoveChapterModal";
import { CreateVolumeModal } from "./sections/CreateVolumeModal";
import { BookCommentsContainer } from "./sections/BookCommentsContainer";
import styles from "./styles/BookDetail.module.css";

interface BookDetailOwnerProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
  containerVersions?: Record<string, number>;
  chaptersLoading?: boolean;
  volumesLoading?: boolean;
  onVolumesRefresh?: () => void;
}

export default function BookDetailOwner({
  book,
  volumes,
  chapters,
  containerVersions = {},
  chaptersLoading = false,
  volumesLoading: _volumesLoading,
  onVolumesRefresh,
}: BookDetailOwnerProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showSuccessAutoClose } = useNotification();

  const [reorderMode, setReorderMode] = useState(false);
  const [chapterPositions, setChapterPositions] = useState<Record<number, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [chapterToMove, setChapterToMove] = useState<Chapter | null>(null);
  const [isMovingChapter, setIsMovingChapter] = useState(false);
  const [createVolumeModalOpen, setCreateVolumeModalOpen] = useState(false);
  const [isCreatingVolume, setIsCreatingVolume] = useState(false);

  const metaRows = useMemo(() => {
    const publicationLabel =
      book.book_type === "AUTHOR" ? "Статус публікації:" : "Статус перекладу:";
    const publicationValue =
      book.book_type === "AUTHOR"
        ? book.isPublic === true
          ? "Публічна"
          : book.isPublic === false
            ? "Приватна"
            : "—"
        : book.translation_status_display ?? (book.isPublic ? "Публічна" : "Перекладається");

    return [
      { label: "Автор:", value: book.author ?? "—" },
      { label: "Перекладач:", value: book.creator_username ?? "—" },
      { label: "Розділів:", value: String(book.chapters_count ?? chapters.length) },
      {
        label: "Жанр:",
        value: book.genres?.length ? book.genres.map((g) => g.name).join(", ") : "—",
      },
      {
        label: "Теги:",
        value: book.tags?.length ? book.tags.map((t) => t.name).join(", ") : "—",
      },
      {
        label: "Фендом:",
        value: book.fandoms?.length ? book.fandoms.map((f) => f.name).join(", ") : "—",
      },
      {
        label: publicationLabel,
        value: publicationValue,
      },
      { label: "Країна:", value: book.country?.name ?? "—" },
      {
        label: "Статус випуску твору:",
        value: book.original_status_display ?? "Виходить",
      },
    ];
  }, [
    book.author,
    book.book_type,
    book.creator_username,
    book.chapters_count,
    chapters.length,
    book.genres,
    book.tags,
    book.fandoms,
    book.country,
    book.translation_status_display,
    book.original_status_display,
    book.isPublic,
  ]);

  const authorMarkText =
    book.book_type === "AUTHOR" ? "Авторська книга" : book.book_type === "TRANSLATION" ? null : null;

  const description = book.description ?? null;

  function enterReorderMode() {
    const map: Record<number, number> = {};
    chapters.forEach((c) => {
      map[c.id] = c.order;
    });
    setChapterPositions(map);
    setReorderMode(true);
    setSaveError(null);
  }

  function exitReorderMode() {
    setReorderMode(false);
    setChapterPositions({});
    setSaveError(null);
  }

  async function handleCreateVolume(title: string) {
    setIsCreatingVolume(true);
    setSaveError(null);
    try {
      await catalogApi.createVolume(book.slug, title);
      await qc.invalidateQueries({ queryKey: catalogKeys.volumes(book.slug) });
      await qc.invalidateQueries({ queryKey: catalogKeys.chapters(book.slug) });
      onVolumesRefresh?.();
      showSuccessAutoClose("Том успішно створено");
    } catch (err) {
      const axErr = err as { response?: { data?: { error?: string; title?: string[] } } };
      const msg =
        axErr.response?.data?.error ??
        (Array.isArray(axErr.response?.data?.title)
          ? axErr.response.data.title.join(", ")
          : "Не вдалося створити том");
      setSaveError(msg);
    } finally {
      setIsCreatingVolume(false);
    }
  }

  async function handleMoveChapter(toVolumeId: number | null, toOrder?: number) {
    if (!chapterToMove) return;
    await doMoveChapter(chapterToMove, toVolumeId, toOrder);
    setChapterToMove(null);
  }

  async function handleMoveChapterToVolume(chapter: Chapter, toVolumeId: number | null, toOrder?: number) {
    await doMoveChapter(chapter, toVolumeId, toOrder);
  }

  async function doMoveChapter(chapter: Chapter, toVolumeId: number | null, toOrder?: number) {
    setIsMovingChapter(true);
    setSaveError(null);
    try {
      await catalogApi.moveChapter(book.slug, chapter.id, toVolumeId, toOrder);
      await qc.invalidateQueries({ queryKey: catalogKeys.chapters(book.slug) });
      await qc.invalidateQueries({ queryKey: catalogKeys.book(book.slug) });
      showSuccessAutoClose("Розділ успішно переміщено");
    } catch (err) {
      const axErr = err as { response?: { status?: number; data?: { error?: string; detail?: string } } };
      const msg =
        axErr.response?.data?.error ?? axErr.response?.data?.detail ?? "Не вдалося перемістити розділ. Спробуйте ще раз.";
      setSaveError(msg);
    } finally {
      setIsMovingChapter(false);
    }
  }

  async function saveOrder() {
    setSaveError(null);
    setIsSavingOrder(true);
    try {
      const byContainer = new Map<number | null, { chapters: Chapter[]; version?: number }>();
      chapters.forEach((ch) => {
        const vid = ch.volume ?? ch.volumeId ?? null;
        if (!byContainer.has(vid)) {
          const key = vid == null ? "null" : String(vid);
          byContainer.set(vid, {
            chapters: [],
            version: containerVersions[key],
          });
        }
        byContainer.get(vid)!.chapters.push(ch);
      });
      for (const [volId, { chapters: groupChapters, version }] of byContainer) {
        const ordered = [...groupChapters].sort(
          (a, b) => (chapterPositions[a.id] ?? a.order) - (chapterPositions[b.id] ?? b.order)
        );
        const orderedIds = ordered.map((c) => c.id);
        if (orderedIds.length === 0) continue;
        await catalogApi.reorderChapters(
          book.slug,
          volId,
          orderedIds,
          version
        );
      }
      await qc.invalidateQueries({ queryKey: ["book-chapters", book.slug] });
      showSuccessAutoClose("Порядок розділів успішно оновлено");
      exitReorderMode();
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: unknown } };
      if (axErr.response?.status === 409) {
        setSaveError("Порядок змінено в іншій вкладці. Оновіть список.");
        await qc.invalidateQueries({ queryKey: ["book-chapters", book.slug] });
        exitReorderMode();
      } else {
        setSaveError("Не вдалося зберегти порядок. Спробуйте ще раз.");
      }
    } finally {
      setIsSavingOrder(false);
    }
  }

  return (
    <BookDetailLayout
      breadcrumbItems={[
        { label: "Головна", to: "/" },
        { label: book.title },
      ]}
      hero={
        <BookHero
          title={book.title}
          titleSecondary={book.titleSecondary ?? undefined}
          coverImageUrl={book.image ? resolveBookCoverUrl(book.image) : null}
          showAgeBadge={book.adult_content === true}
          authorMarkText={authorMarkText ?? undefined}
          metaRows={metaRows}
          bookSlug={book.slug}
          bookType={book.book_type ?? undefined}
          ratingValue={book.ratingValue ?? null}
          ratingCount={book.ratingCount ?? null}
          thankAuthorCoins={book.thankAuthorCoins ?? 10}
          bookId={book.id}
          showSettings
          onBecomeTranslator={() => {}}
        />
      }
      description={<BookDescription description={description} />}
      authorWorks={<AuthorWorks />}
      chapters={
        <>
          {saveError && <div role="alert" className={styles.chapterSaveError}>{saveError}</div>}
          <BookChapters
            chapters={chapters}
            isOwner
            loading={chaptersLoading}
            addChapterTo={`/books/${book.slug}/add-chapter`}
            onCreateVolume={() => setCreateVolumeModalOpen(true)}
            isCreatingVolume={isCreatingVolume}
            onChangeOrder={enterReorderMode}
            onRead={(ch) => navigate(`/books/${book.slug}/chapters/${ch.slug ?? ch.id}`)}
            onEdit={(ch) => navigate(`/books/${book.slug}/edit-chapter/${ch.id}`)}
            onMove={(ch) => setChapterToMove(ch)}
            onMoveToVolume={handleMoveChapterToVolume}
            isMovingToVolume={isMovingChapter}
            onDelete={async (ch) => {
              if (!window.confirm("Ви впевнені, що хочете видалити цей розділ?")) return;
              try {
                await catalogApi.deleteChapter(book.slug, ch.id);
                await qc.invalidateQueries({ queryKey: catalogKeys.chapters(book.slug) });
                await qc.invalidateQueries({ queryKey: catalogKeys.book(book.slug) });
              } catch (err) {
                setSaveError(
                  err && typeof err === "object" && "message" in err
                    ? String((err as { message: unknown }).message)
                    : "Помилка при видаленні розділу"
                );
              }
            }}
            getChapterPrice={(ch) =>
              ch.is_paid && ch.price != null && ch.price > 0
                ? `${Number(ch.price).toFixed(2)} FanCoins`
                : "Безкоштовно"
            }
            getChapterDate={(ch) =>
              ch.created_at
                ? new Date(ch.created_at).toLocaleDateString("uk-UA", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "—"
            }
            reorderMode={reorderMode}
            chapterPositions={chapterPositions}
            onPositionChange={(updates) => setChapterPositions((p) => ({ ...p, ...updates }))}
            onSaveOrder={saveOrder}
            onCancelReorder={exitReorderMode}
            isSavingOrder={isSavingOrder}
          />
          <MoveChapterModal
            open={chapterToMove != null}
            onClose={() => setChapterToMove(null)}
            chapter={chapterToMove}
            volumes={volumes}
            onConfirm={handleMoveChapter}
            isSubmitting={isMovingChapter}
          />
          <CreateVolumeModal
            open={createVolumeModalOpen}
            onClose={() => setCreateVolumeModalOpen(false)}
            onConfirm={handleCreateVolume}
            isSubmitting={isCreatingVolume}
          />
        </>
      }
      comments={<BookCommentsContainer type="book" slug={book.slug} isOwner />}
    />
  );
}
