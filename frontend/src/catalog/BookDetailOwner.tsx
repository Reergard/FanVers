import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { catalogApi, type Book, type Chapter, type Volume } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";
import { BookDetailLayout } from "./BookDetailLayout";
import { BookHero } from "./sections/BookHero";
import { BookDescription } from "./sections/BookDescription";
import { AuthorWorks } from "./sections/AuthorWorks";
import { BookChapters } from "./sections/BookChapters";
import { BookComments } from "./sections/BookComments";

interface BookDetailOwnerProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
}

export default function BookDetailOwner({
  book,
  volumes,
  chapters,
}: BookDetailOwnerProps) {
  const qc = useQueryClient();
  const { isAuthenticated, userId } = useAuth();

  const isOwner = useMemo(
    () =>
      Boolean(
        isAuthenticated &&
          userId != null &&
          (book.ownerId ?? book.owner) !== undefined &&
          (book.ownerId ?? book.owner) === userId
      ),
    [isAuthenticated, userId, book.ownerId, book.owner]
  );

  const [reorderMode, setReorderMode] = useState(false);
  const [chapterPositions, setChapterPositions] = useState<Record<number, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const metaRows = useMemo(
    () => [
      { label: "Автор:", value: "—" },
      { label: "Перекладач:", value: "—" },
      { label: "Розділів:", value: String(book.chapters_count ?? chapters.length) },
      { label: "Жанр:", value: "—" },
      { label: "Теги:", value: "—" },
      { label: "Фендом:", value: "—" },
      { label: "Країна:", value: "—" },
      { label: "Статус перекладу:", value: book.isPublic ? "Публічна" : "Перекладається" },
      { label: "Статус випуску твору:", value: "Виходить" },
    ],
    [book.chapters_count, book.isPublic, chapters.length]
  );

  const description = (book as Book & { description?: string }).description ?? null;

  if (!isOwner) {
    return <div>Немає прав (тільки власник).</div>;
  }

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
          titleSecondary={(book as Book & { titleSecondary?: string }).titleSecondary ?? undefined}
          coverImageUrl={(book as Book & { coverImageUrl?: string }).coverImageUrl ?? null}
          showAgeBadge={(book as Book & { ageRestriction?: boolean }).ageRestriction ?? false}
          authorMarkText={(book as Book & { authorMark?: string }).authorMark ?? "Авторська книга"}
          metaRows={metaRows}
          ratingValue={(book as Book & { ratingValue?: number }).ratingValue ?? null}
          ratingCount={(book as Book & { ratingCount?: number }).ratingCount ?? null}
          thankAuthorCoins={(book as Book & { thankAuthorCoins?: number }).thankAuthorCoins ?? 10}
          onBookmark={() => {}}
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
      comments={<BookComments comments={[]} />}
    />
  );
}
