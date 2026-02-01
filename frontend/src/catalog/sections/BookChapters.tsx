import styles from "../styles/BookDetail.module.css";
import type { Chapter } from "../../api/catalogApi";

export type BookChaptersProps = {
  chapters: Chapter[];
  isOwner?: boolean;
  onAddChapter?: () => void;
  onCreateVolume?: () => void;
  onChangeOrder?: () => void;
  onRead?: (chapter: Chapter) => void;
  onEdit?: (chapter: Chapter) => void;
  onDelete?: (chapter: Chapter) => void;
  getChapterPrice?: (chapter: Chapter) => string;
  getChapterDate?: (chapter: Chapter) => string;
};

export function BookChapters({
  chapters,
  isOwner = false,
  onAddChapter,
  onCreateVolume,
  onChangeOrder,
  onRead,
  onEdit,
  onDelete,
  getChapterPrice = () => "—",
  getChapterDate = () => "—",
}: BookChaptersProps) {
  const sorted = [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <section className={styles.chapters} aria-labelledby="chapters-heading">
      <header className={styles.chaptersHeader}>
        <h3 id="chapters-heading">Розділи</h3>

        {isOwner && (
          <div className={styles.chapterActions}>
            <button type="button" onClick={onAddChapter}>
              Додати розділ
            </button>
            <button type="button" onClick={onCreateVolume}>
              Створити том
            </button>
            <button type="button" onClick={onChangeOrder}>
              Змінити порядок розділів
            </button>
          </div>
        )}
      </header>

      <div className={styles.chapterTable} role="table" aria-label="Список розділів">
        <div className={styles.chapterTableHeader} role="row">
          <span role="columnheader">Назва</span>
          <span role="columnheader">Вартість</span>
          <span role="columnheader">Створено</span>
          <span role="columnheader" aria-label="Дії" />
        </div>
        {sorted.map((chapter) => (
          <div key={chapter.id} className={styles.chapterRow} role="row">
            <div className={styles.chapterTitle} role="cell">
              Розділ {chapter.position ?? chapter.id}: {chapter.title}
              {isOwner && onEdit && (
                <>
                  {" "}
                  <button
                    type="button"
                    className={styles.editLink}
                    onClick={() => onEdit(chapter)}
                  >
                    Редагувати
                  </button>
                </>
              )}
            </div>
            <div className={styles.chapterPrice} role="cell">
              {getChapterPrice(chapter)}
            </div>
            <div className={styles.chapterDate} role="cell">
              {getChapterDate(chapter)}
            </div>
            <div className={styles.chapterRowActions} role="cell">
              {onRead && (
                <button type="button" onClick={() => onRead(chapter)}>
                  Читати
                </button>
              )}
              {isOwner && onDelete && (
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => onDelete(chapter)}
                >
                  Видалити
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
