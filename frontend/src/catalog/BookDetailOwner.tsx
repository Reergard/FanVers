import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { catalogApi, type Book, type Chapter, type Volume } from "../api/catalogApi";
import { useAuth } from "../auth/useAuth";

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

  if (!isOwner) return <div>Немає прав (тільки власник).</div>;

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
    <div>
      <div>Owner mode: {book.title}</div>
      <div>Volumes: {volumes.length}</div>
      <div>Chapters: {chapters.length}</div>
      {saveError && <div>{saveError}</div>}

      {!reorderMode ? (
        <button type="button" onClick={enterReorderMode}>
          Reorder chapters
        </button>
      ) : (
        <>
          <button type="button" onClick={saveOrder}>
            Save order
          </button>
          <button type="button" onClick={exitReorderMode}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
