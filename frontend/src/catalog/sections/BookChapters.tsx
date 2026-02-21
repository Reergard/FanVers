import { useState } from "react";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "../styles/BookDetail.module.css";
import type { Chapter } from "../../api/catalogApi";
import checkIcon from "../assets/icons/check.svg";
import deleteIcon from "../assets/icons/Delete.svg";
import editIcon from "../assets/icons/Edit.svg";
import readIcon from "../assets/icons/read.svg";
import downIcon from "../assets/icons/down.svg";
import upIcon from "../assets/icons/up.svg";

export type BookChaptersProps = {
  chapters: Chapter[];
  isOwner?: boolean;
  loading?: boolean;
  /** Якщо задано — кнопка «Додати розділ» рендериться як Link на цей шлях */
  addChapterTo?: string;
  onAddChapter?: () => void;
  onCreateVolume?: () => void;
  onChangeOrder?: () => void;
  onMoveUp?: (chapter: Chapter) => void;
  onMoveDown?: (chapter: Chapter) => void;
  onRead?: (chapter: Chapter) => void;
  onEdit?: (chapter: Chapter) => void;
  onDelete?: (chapter: Chapter) => void;
  getReadLabel?: (chapter: Chapter) => string;
  getChapterPrice?: (chapter: Chapter) => string;
  getChapterDate?: (chapter: Chapter) => string;
};

export function BookChapters({
  chapters,
  isOwner = false,
  loading = false,
  addChapterTo,
  onAddChapter,
  onCreateVolume,
  onChangeOrder,
  onMoveUp,
  onMoveDown,
  onRead,
  onEdit,
  onDelete,
  getReadLabel = () => "Читати",
  getChapterPrice = () => "—",
  getChapterDate = () => "—",
}: BookChaptersProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const sorted = [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className={styles.chapters} aria-label="Розділи">
      <header className={styles.chaptersHeader}>
        {isOwner && (
          <>
            <div className={styles.chapterActions}>
              {addChapterTo ? (
                <ActionButton variant="primary" to={addChapterTo}>Додати розділ</ActionButton>
              ) : (
                <ActionButton variant="primary" onClick={onAddChapter}>Додати розділ</ActionButton>
              )}
              <ActionButton variant="primary" onClick={onCreateVolume}>Створити том</ActionButton>
            </div>
            <div className={styles.chapterActionsRight}>
              <ActionButton variant="primary" onClick={onChangeOrder}>Змінити порядок розділів</ActionButton>
            </div>
          </>
        )}
      </header>

      <div className={styles.chapterTable} role="table" aria-label="Список розділів">
        <div className={styles.chapterTableHeader} role="row">
          <span className={styles.chapterHeaderName} role="columnheader">Назва</span>
          <span className={styles.chapterHeaderPrice} role="columnheader">Вартість</span>
          <span className={styles.chapterHeaderDate} role="columnheader">Створено</span>
        </div>
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonChapterRow} role="row" aria-hidden="true" />
          ))
        ) : (
        sorted.map((chapter, index) => {
          const displayPosition = chapter.position > 0 ? chapter.position : index + 1;
          return (
          <div key={chapter.id} className={styles.chapterRow} role="row">
            <div className={styles.chapterRowName} role="cell">
              <label className={styles.chapterCheckboxWrap}>
                <input
                  type="checkbox"
                  className={styles.chapterCheckboxInput}
                  checked={selectedIds.has(chapter.id)}
                  onChange={() => toggleSelected(chapter.id)}
                  aria-label={`Обрати розділ ${displayPosition}`}
                />
                <span className={styles.chapterCheckboxBox}>
                  {selectedIds.has(chapter.id) && <img src={checkIcon} alt="" className={styles.chapterCheckIcon} aria-hidden />}
                </span>
              </label>
              <div className={styles.chapterPositionWrap}>
                <input
                  type="text"
                  className={styles.chapterPositionInput}
                  data-digits={Math.min(4, String(displayPosition).length) || 1}
                  value={displayPosition}
                  readOnly
                  aria-label="Позиція"
                />
                <div className={styles.chapterPositionArrows}>
                  <button
                    type="button"
                    className={styles.chapterPositionBtn}
                    onClick={() => onMoveUp?.(chapter)}
                    disabled={onMoveUp == null}
                    aria-label="Вгору"
                  >
                    <img src={upIcon} alt="" className={styles.chapterPositionArrowIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.chapterPositionBtn}
                    onClick={() => onMoveDown?.(chapter)}
                    disabled={onMoveDown == null}
                    aria-label="Вниз"
                  >
                    <img src={downIcon} alt="" className={styles.chapterPositionArrowIcon} aria-hidden />
                  </button>
                </div>
              </div>
              {onRead ? (
                <button
                  type="button"
                  className={styles.chapterTitleBtn}
                  onClick={() => onRead(chapter)}
                  aria-label={`${getReadLabel(chapter)}: ${chapter.title}`}
                >
                  <span className={styles.chapterTitleText}>{chapter.title}</span>
                </button>
              ) : (
                <span className={styles.chapterTitleText}>{chapter.title}</span>
              )}
              {isOwner && onEdit && (
                <button
                  type="button"
                  className={styles.chapterEditBtn}
                  onClick={() => onEdit(chapter)}
                >
                  <img src={editIcon} alt="" className={styles.chapterActionIcon} aria-hidden />
                  Редагувати
                </button>
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
                <button type="button" className={styles.chapterReadBtn} onClick={() => onRead(chapter)}>
                  <img src={readIcon} alt="" className={styles.chapterActionIcon} aria-hidden />
                  {getReadLabel(chapter)}
                </button>
              )}
              {isOwner && onDelete && (
                <button
                  type="button"
                  className={styles.chapterDeleteBtn}
                  onClick={() => onDelete(chapter)}
                >
                  <img src={deleteIcon} alt="" className={styles.chapterActionIcon} aria-hidden />
                  Видалити
                </button>
              )}
            </div>
          </div>
          );
        })
        )}
      </div>
    </section>
  );
}
