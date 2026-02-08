import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { catalogApi, type Book, type Chapter, type Volume } from "../api/catalogApi";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookComments, MOCK_COMMENTS } from "./sections/BookComments";

interface BookDetailOwnerProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
  chaptersLoading?: boolean;
  volumesLoading?: boolean;
}

export default function BookDetailOwner({
  book,
  volumes: _volumes,
  chapters,
  chaptersLoading = false,
  volumesLoading: _volumesLoading,
}: BookDetailOwnerProps) {
  const qc = useQueryClient();

  const [reorderMode, setReorderMode] = useState(false);
  const [chapterPositions, setChapterPositions] = useState<Record<number, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const metaRows = useMemo(
    () => [
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
      { label: "Країна:", value: book.country?.name ?? "—" },
      {
        label: "Статус перекладу:",
        value: book.translation_status_display ?? (book.isPublic ? "Публічна" : "Перекладається"),
      },
      {
        label: "Статус випуску твору:",
        value: book.original_status_display ?? "Виходить",
      },
    ],
    [
      book.author,
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
    ]
  );

  const authorMarkText =
    book.book_type === "AUTHOR" ? "Авторська книга" : book.book_type === "TRANSLATION" ? null : null;

  const description = book.description ?? null;

  function enterReorderMode() {
    const map: Record<number, number> = {};
    chapters.forEach((c, idx) => {
      map[c.id] = c.position ?? idx + 1;
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
    try {
      await catalogApi.createVolume(book.slug, title);
      await qc.invalidateQueries({ queryKey: ["book-volumes", book.slug] });
    } catch {
      setSaveError("Не вдалося створити том");
    }
  }

  async function saveOrder() {
    setSaveError(null);
    try {
      const chapterOrders = Object.entries(chapterPositions).map(([id, position]) => ({
        chapter_id: Number(id),
        position,
        volume_id: null as number | null,
      }));
      await catalogApi.updateChapterOrderNoVolume(chapterOrders);
      await qc.invalidateQueries({ queryKey: ["book-chapters", book.slug] });
      exitReorderMode();
    } catch {
      setSaveError("Не вдалося зберегти порядок. Спробуйте ще раз.");
    }
  }

  return (
    <BookDetailLayout
      hero={
        <BookHero
          title={book.title}
          titleSecondary={book.titleSecondary ?? undefined}
          coverImageUrl={book.image ?? null}
          showAgeBadge={book.adult_content === true}
          authorMarkText={authorMarkText ?? undefined}
          metaRows={metaRows}
          ratingValue={book.ratingValue ?? null}
          ratingCount={book.ratingCount ?? null}
          thankAuthorCoins={book.thankAuthorCoins ?? 10}
          bookId={book.id}
          onTranslationSettings={() => {}}
          onBecomeTranslator={() => {}}
        />
      }
      description={<BookDescription description={description} />}
      authorWorks={<AuthorWorks />}
      chapters={
        <>
          {saveError && <div role="alert">{saveError}</div>}
          {!reorderMode ? (
            <BookChapters
              chapters={chapters}
              isOwner
              loading={chaptersLoading}
              onAddChapter={() => {}}
              onCreateVolume={() => handleCreateVolume("Новий том")}
              onChangeOrder={enterReorderMode}
              onRead={(ch) => {}}
              onEdit={(ch) => {}}
              onDelete={(ch) => {}}
              getChapterPrice={() => "10 ₴"}
              getChapterDate={() => "13.02.2023"}
            />
          ) : (
            <div>
              <button type="button" onClick={saveOrder}>
                Зберегти порядок
              </button>
              <button type="button" onClick={exitReorderMode}>
                Скасувати
              </button>
            </div>
          )}
        </>
      }
      comments={<BookComments comments={MOCK_COMMENTS} />}
    />
  );
}
