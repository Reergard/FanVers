import { useMemo, useState, useEffect } from "react";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "../styles/BookDetail.module.css";
import type { Chapter } from "../../api/catalogApi";
import checkIcon from "../assets/icons/check.svg";
import deleteIcon from "../assets/icons/Delete.svg";
import editIcon from "../assets/icons/Edit.svg";
import readIcon from "../assets/icons/read.svg";
import downIcon from "../assets/icons/down.svg";
import upIcon from "../assets/icons/up.svg";

/** Витягує числовий id тому (захист від volume як об'єкта з API) */
function toVolumeId(ch: Chapter): number | null {
  const v = ch.volume ?? ch.volumeId;
  return typeof v === "number" ? v : null;
}

/** Групує глави по томах. Backend вже віддає в правильному порядку — не змінюємо його. */
type VolumeGroup = {
  volumeId: number | "no-volume";
  title: string;
  chapters: Chapter[];
};

function groupChapters(chapters: Chapter[]): VolumeGroup[] {
  const map = new Map<number | "no-volume", VolumeGroup>();
  for (const ch of chapters) {
    const vid = toVolumeId(ch);
    const key: number | "no-volume" = vid != null ? vid : "no-volume";
    if (!map.has(key)) {
      map.set(key, {
        volumeId: key,
        title: key === "no-volume" ? "Розділи без тому" : (ch.volume_title ?? `Том ${key}`),
        chapters: [],
      });
    }
    map.get(key)!.chapters.push(ch);
  }
  const result: VolumeGroup[] = [];
  const keys = Array.from(map.keys());
  const noVol = keys.find((k) => k === "no-volume");
  const volKeys = keys.filter((k) => k !== "no-volume").sort((a, b) => (a as number) - (b as number));
  for (const k of volKeys) result.push(map.get(k)!);
  if (noVol) result.push(map.get(noVol)!);
  return result;
}

export type BookChaptersProps = {
  chapters: Chapter[];
  isOwner?: boolean;
  loading?: boolean;
  /** Якщо задано — кнопка «Додати розділ» рендериться як Link на цей шлях */
  addChapterTo?: string;
  onAddChapter?: () => void;
  onCreateVolume?: () => void;
  onChangeOrder?: () => void;
  onRead?: (chapter: Chapter) => void;
  onEdit?: (chapter: Chapter) => void;
  onDelete?: (chapter: Chapter) => void;
  onMove?: (chapter: Chapter) => void;
  /** Перемістити главу в інший том (для стрілок на межі тому) */
  onMoveToVolume?: (chapter: Chapter, toVolumeId: number | null, toOrder?: number) => void | Promise<void>;
  getReadLabel?: (chapter: Chapter) => string;
  getChapterPrice?: (chapter: Chapter) => string;
  getChapterDate?: (chapter: Chapter) => string;
  /** Режим зміни порядку: поле позиції редагується */
  reorderMode?: boolean;
  /** Позиції глав у режимі reorder (chapterId -> position) */
  chapterPositions?: Record<number, number>;
  /** Зміна позицій глав (batch: id -> position). Для swap передати обидві пари. */
  onPositionChange?: (updates: Record<number, number>) => void;
  /** Підтвердити зміну порядку */
  onSaveOrder?: () => void;
  /** Скасувати режим reorder */
  onCancelReorder?: () => void;
  /** Чи зберігається порядок (loading) */
  isSavingOrder?: boolean;
  /** Чи виконується переміщення між томами (блокує стрілки) */
  isMovingToVolume?: boolean;
  /** Чи створюється том (блокує кнопку) */
  isCreatingVolume?: boolean;
};

export function BookChapters({
  chapters,
  isOwner = false,
  loading = false,
  addChapterTo,
  onAddChapter,
  onCreateVolume,
  onChangeOrder,
  onRead,
  onEdit,
  onDelete,
  onMove,
  onMoveToVolume,
  getReadLabel = () => "Читати",
  getChapterPrice = () => "—",
  getChapterDate = () => "—",
  reorderMode = false,
  chapterPositions = {},
  onPositionChange,
  onSaveOrder,
  onCancelReorder,
  isSavingOrder = false,
  isMovingToVolume = false,
  isCreatingVolume = false,
}: BookChaptersProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const grouped = useMemo(() => groupChapters(chapters), [chapters]);

  useEffect(() => {
    if (!reorderMode) setEditingChapterId(null);
  }, [reorderMode]);

  /** У режимі reorder сортуємо глави в кожній групі за поточними chapterPositions (локально) */
  const displayGrouped = useMemo(() => {
    if (!reorderMode || Object.keys(chapterPositions).length === 0) return grouped;
    return grouped.map((group) => ({
      ...group,
      chapters: [...group.chapters].sort((a, b) => {
        const posA = chapterPositions[a.id] ?? a.order;
        const posB = chapterPositions[b.id] ?? b.order;
        return posA - posB;
      }),
    }));
  }, [grouped, reorderMode, chapterPositions]);

  function toggleSelected(id: number) {
    if (!isOwner) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getDisplayOrder(chapter: Chapter): number {
    if (reorderMode && chapterPositions[chapter.id] != null) {
      return chapterPositions[chapter.id];
    }
    return chapter.order;
  }

  /** Обмін позицій двох глав (для стрілок вгору/вниз) */
  function handleSwapWithNeighbor(chapter: Chapter, neighbor: Chapter) {
    const myPos = chapterPositions[chapter.id] ?? chapter.order;
    const neighborPos = chapterPositions[neighbor.id] ?? neighbor.order;
    onPositionChange?.({ [chapter.id]: neighborPos, [neighbor.id]: myPos });
    setEditingChapterId(null);
  }

  function applyPositionInput(chapterId: number, value: string, groupChapters: Chapter[]) {
    const num = Math.max(1, parseInt(value, 10) || 1);
    const currentChapter = groupChapters.find((c) => c.id === chapterId);
    if (!currentChapter || !onPositionChange) return;
    const myPos = chapterPositions[chapterId] ?? currentChapter.order;
    if (num === myPos) return;
    const targetChapter = groupChapters.find((c) => (chapterPositions[c.id] ?? c.order) === num);
    if (targetChapter) {
      const targetPos = chapterPositions[targetChapter.id] ?? targetChapter.order;
      onPositionChange({ [chapterId]: targetPos, [targetChapter.id]: myPos });
    } else {
      onPositionChange({ [chapterId]: num });
    }
    setEditingChapterId(null);
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
              <ActionButton
                variant="primary"
                onClick={onCreateVolume}
                disabled={!onCreateVolume || isCreatingVolume}
                loading={isCreatingVolume}
              >
                Створити том
              </ActionButton>
            </div>
            <div className={styles.chapterActionsRight}>
              {reorderMode ? (
                <>
                  <ActionButton
                    variant="primary"
                    onClick={onSaveOrder}
                    disabled={isSavingOrder}
                  >
                    {isSavingOrder ? "Збереження…" : "Підтвердити зміну"}
                  </ActionButton>
                  <ActionButton variant="outline" onClick={onCancelReorder} disabled={isSavingOrder}>
                    Скасувати
                  </ActionButton>
                </>
              ) : (
                <ActionButton variant="primary" onClick={onChangeOrder}>
                  Змінити порядок розділів
                </ActionButton>
              )}
            </div>
          </>
        )}
      </header>

      <div className={styles.chapterTable} role="table" aria-label="Список розділів">
        <div className={styles.chapterTableHeader} role="row">
          <span
            className={styles.chapterHeaderService}
            role="columnheader"
            aria-hidden={!reorderMode}
          >
            {reorderMode ? "Позиція" : ""}
          </span>
          <span className={styles.chapterHeaderName} role="columnheader">Назва</span>
          <span className={styles.chapterHeaderPrice} role="columnheader">Вартість</span>
          <span className={styles.chapterHeaderDate} role="columnheader">Створено</span>
          <span className={styles.chapterHeaderActions} role="columnheader" aria-hidden="true" />
        </div>
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonChapterRow} role="row" aria-hidden="true" />
          ))
        ) : (
          (() => {
            let globalIndex = 0;
            return displayGrouped.map((group, groupIdx) => {
              const prevGroup = groupIdx > 0 ? displayGrouped[groupIdx - 1] : null;
              const nextGroup = groupIdx < displayGrouped.length - 1 ? displayGrouped[groupIdx + 1] : null;
              const prevGroupVolumeId = prevGroup
                ? prevGroup.volumeId === "no-volume"
                  ? null
                  : (prevGroup.volumeId as number)
                : null;
              const nextGroupVolumeId = nextGroup
                ? nextGroup.volumeId === "no-volume"
                  ? null
                  : (nextGroup.volumeId as number)
                : null;
              return (
            <div key={group.volumeId} className={styles.chapterVolumeGroup}>
              <div className={styles.chapterVolumeHeader} role="row">
                <span className={styles.chapterVolumeTitle}>{group.title}</span>
              </div>
              {group.chapters.map((chapter, idx) => {
                globalIndex++;
                const displayOrder = getDisplayOrder(chapter);
                const prevChapter = idx > 0 ? group.chapters[idx - 1] : null;
                const nextChapter = idx < group.chapters.length - 1 ? group.chapters[idx + 1] : null;
                const canMoveUp = prevChapter ? !!onPositionChange : !!(prevGroup && onMoveToVolume);
                const canMoveDown = nextChapter ? !!onPositionChange : !!(nextGroup && onMoveToVolume);
                const handleArrowUp = () => {
                  if (prevChapter) {
                    handleSwapWithNeighbor(chapter, prevChapter);
                  } else if (prevGroup && onMoveToVolume) {
                    onMoveToVolume(chapter, prevGroupVolumeId); // в кінець попереднього тому
                  }
                };
                const handleArrowDown = () => {
                  if (nextChapter) {
                    handleSwapWithNeighbor(chapter, nextChapter);
                  } else if (nextGroup && onMoveToVolume) {
                    onMoveToVolume(chapter, nextGroupVolumeId, 1); // на початок наступного тому
                  }
                };
                return (
                  <div key={chapter.id} className={styles.chapterRow} role="row">
                    <div className={styles.chapterRowService} role="cell">
                      <label className={styles.chapterCheckboxWrap}>
                        <input
                          type="checkbox"
                          className={styles.chapterCheckboxInput}
                          checked={selectedIds.has(chapter.id)}
                          onChange={() => toggleSelected(chapter.id)}
                          disabled={!isOwner}
                          aria-label={`Обрати розділ ${displayOrder}`}
                        />
                        <span className={styles.chapterCheckboxBox}>
                          {selectedIds.has(chapter.id) && (
                            <img src={checkIcon} alt="" className={styles.chapterCheckIcon} aria-hidden />
                          )}
                        </span>
                      </label>
                      {isOwner && reorderMode && (
                        <div className={styles.chapterPositionWrap}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={styles.chapterPositionInput}
                            data-digits={Math.min(4, (editingChapterId === chapter.id ? editingValue : String(displayOrder)).length) || 1}
                            value={editingChapterId === chapter.id ? editingValue : String(displayOrder)}
                            onFocus={() => {
                              setEditingChapterId(chapter.id);
                              setEditingValue(String(displayOrder));
                            }}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              setEditingValue(raw);
                            }}
                            onBlur={() => {
                              if (editingChapterId !== chapter.id) return;
                              const raw = editingValue.trim();
                              if (raw !== "") {
                                applyPositionInput(chapter.id, raw, group.chapters);
                              } else {
                                setEditingChapterId(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            aria-label="Позиція"
                          />
                          <div className={styles.chapterPositionArrows}>
                              <button
                                type="button"
                                className={styles.chapterPositionBtn}
                                onClick={handleArrowUp}
                                disabled={isMovingToVolume || !canMoveUp}
                                aria-label="Вгору"
                              >
                                <img src={upIcon} alt="" className={styles.chapterPositionArrowIcon} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className={styles.chapterPositionBtn}
                                onClick={handleArrowDown}
                                disabled={isMovingToVolume || !canMoveDown}
                                aria-label="Вниз"
                              >
                                <img src={downIcon} alt="" className={styles.chapterPositionArrowIcon} aria-hidden />
                              </button>
                            </div>
                        </div>
                      )}
                    </div>
                    <div className={styles.chapterRowNameAndEdit} role="cell">
                      <div className={styles.chapterRowName}>
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
                      </div>
                      {isOwner && (
                        <div className={styles.chapterRowEdit}>
                          {reorderMode && onMove ? (
                            <button
                              type="button"
                              className={styles.chapterEditBtn}
                              onClick={() => onMove(chapter)}
                            >
                              Перемістити в том
                            </button>
                          ) : onEdit ? (
                            <button
                              type="button"
                              className={styles.chapterEditBtn}
                              onClick={() => onEdit(chapter)}
                            >
                              <img src={editIcon} alt="" className={styles.chapterActionIcon} aria-hidden />
                              Редагувати
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className={styles.chapterRowMeta} role="cell">
                      <div className={styles.chapterPrice}>
                        <span className={styles.chapterPriceLabel}>
                          Вартість:
                          <br />
                          (FanCoins)
                        </span>
                        <span className={styles.chapterPriceValue}>{getChapterPrice(chapter)}</span>
                      </div>
                      <div className={styles.chapterDate}>
                        <span className={styles.chapterDateLabel}>Створено</span>
                        <span className={styles.chapterDateValue}>{getChapterDate(chapter)}</span>
                      </div>
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
              })}
            </div>
          );
          });
          })()
        )}
      </div>
    </section>
  );
}
