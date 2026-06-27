import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useLocation } from "react-router-dom";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { useAuth } from "../../auth/useAuth";
import { useAuthModal } from "../../auth/AuthModalContext";
import {
  getSubscriptionSettings,
  applyPlan,
  purchaseChapter,
  subscriptionKeys,
  type SubscriptionSettingsResponse,
} from "../../api/subscriptionApi";
import styles from "../styles/BookDetail.module.css";
import { catalogKeys, type Chapter, type Volume } from "../../api/catalogApi";
import { monitoringKeys } from "../../api/monitoringKeys";
import checkIcon from "../assets/icons/check.svg";
import deleteIcon from "../assets/icons/Delete.svg";
import editIcon from "../assets/icons/Edit.svg";
import readIcon from "../assets/icons/read.svg";
import downIcon from "../assets/icons/down.svg";
import upIcon from "../assets/icons/up.svg";
import { prefetchChapterEditor } from "../../editors/components/LazyChapterEditor";

/** Витягує числовий id тому (захист від volume як об'єкта з API) */
function toVolumeId(ch: Chapter): number | null {
  const v = ch.volume ?? ch.volumeId;
  return typeof v === "number" ? v : null;
}

/** Групує глави по томах. Завжди показує ВСІ томи (включно з порожніми) і ВСІ глави. */
type VolumeGroup = {
  volumeId: number | "no-volume";
  title: string;
  chapters: Chapter[];
};

function groupChapters(chapters: Chapter[], volumes?: Volume[]): VolumeGroup[] {
  const chaptersByVolume = new Map<number | "no-volume", Chapter[]>();

  for (const ch of chapters) {
    const vid = toVolumeId(ch);
    const key: number | "no-volume" = vid != null ? vid : "no-volume";
    if (!chaptersByVolume.has(key)) {
      chaptersByVolume.set(key, []);
    }
    chaptersByVolume.get(key)!.push(ch);
  }

  const result: VolumeGroup[] = [];

  // 1. Усі томи з API (включно з порожніми) — у порядку
  if (volumes && volumes.length > 0) {
    for (const vol of volumes) {
      const chs = chaptersByVolume.get(vol.id) ?? [];
      const title = chs.length > 0 && chs[0].volume_title
        ? chs[0].volume_title
        : (vol.title ?? `Том ${vol.id}`);
      result.push({
        volumeId: vol.id,
        title,
        chapters: chs,
      });
    }
  } else {
    // Fallback: volumes не завантажено — показуємо тільки томи, що мають глави
    const volKeys = Array.from(chaptersByVolume.keys()).filter((k) => k !== "no-volume") as number[];
    volKeys.sort((a, b) => a - b);
    for (const k of volKeys) {
      const chs = chaptersByVolume.get(k)!;
      result.push({
        volumeId: k,
        title: chs[0]?.volume_title ?? `Том ${k}`,
        chapters: chs,
      });
    }
  }

  // 2. Розділи без тому — завжди в кінці
  const noVolChapters = chaptersByVolume.get("no-volume");
  if (noVolChapters) {
    result.push({
      volumeId: "no-volume",
      title: "Розділи без тому",
      chapters: noVolChapters,
    });
  }

  return result;
}

export type BookChaptersProps = {
  chapters: Chapter[];
  /** Список томів — якщо передано, показуються й порожні томи */
  volumes?: Volume[];
  isOwner?: boolean;
  loading?: boolean;
  /** Якщо задано — кнопка «Додати розділ» рендериться як Link на цей шлях */
  addChapterTo?: string;
  onAddChapter?: () => void;
  onCreateVolume?: () => void;
  /** Видалити том (тільки для власника) */
  onDeleteVolume?: (volumeId: number, title: string, chaptersCount: number) => void;
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
  /** Чи видаляється том (блокує кнопки видалення) */
  isDeletingVolume?: boolean;
  /** Slug книги (для читачів — застосування плану до обраних розділів) */
  bookSlug?: string;
  /** Після успішної покупки/застосування плану */
  onPurchaseSuccess?: () => void;
  /** Чи потрібно перевіряти auth перед покупкою (для reader mode) */
  requireAuthForPurchase?: boolean;
};

export function BookChapters({
  chapters,
  volumes,
  isOwner = false,
  loading = false,
  addChapterTo,
  onAddChapter,
  onCreateVolume,
  onDeleteVolume,
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
  isDeletingVolume = false,
  bookSlug,
  onPurchaseSuccess,
  requireAuthForPurchase = false,
}: BookChaptersProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const { isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [subscriptionSelectedIds, setSubscriptionSelectedIds] = useState<Set<number>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [purchasingChapterId, setPurchasingChapterId] = useState<number | null>(null);

  const { data: subSettings } = useQuery({
    queryKey: bookSlug ? subscriptionKeys.settings(bookSlug) : ["subscription", "none"],
    queryFn: () => getSubscriptionSettings(bookSlug!),
    enabled: !isOwner && !!bookSlug,
  });

  const subResp = subSettings as SubscriptionSettingsResponse | undefined;
  const activeSub = subResp?.active_subscription;
  const plans = (subResp?.plans ?? []).filter(
    (p) => p.is_active && p.purchase_mode === "instant"
  );
  const paidChaptersForApply = chapters.filter(
    (c) => c.is_paid && !c.is_purchased && c.price != null && c.price > 0
  );
  const canApplyPlan =
    !isOwner &&
    !!bookSlug &&
    !activeSub &&
    plans.length > 0 &&
    paidChaptersForApply.length > 0 &&
    (isAuthenticated || !requireAuthForPurchase);

  const hasPrepaidForChapter =
    !isOwner &&
    !!activeSub &&
    (activeSub.remaining_chapters_count ?? 0) > 0;

  const purchaseChapterMutation = useMutation({
    mutationFn: (chapterId: number) => purchaseChapter(chapterId),
    onSuccess: () => {
      if (bookSlug) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.settings(bookSlug) });
        queryClient.invalidateQueries({ queryKey: catalogKeys.chapters(bookSlug) });
      }
      queryClient.invalidateQueries({ queryKey: monitoringKeys.readingStats() });
      showSuccess("Главу придбано");
      onPurchaseSuccess?.();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError && err.response?.data && typeof err.response.data === "object" && "error" in (err.response.data as object)
          ? String((err.response.data as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : "Помилка покупки";
      showError(msg);
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ planId, chapterIds }: { planId: number; chapterIds: number[] }) =>
      applyPlan(bookSlug!, planId, chapterIds),
    onSuccess: () => {
      if (bookSlug) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.settings(bookSlug) });
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.userSubscriptions() });
      }
      queryClient.invalidateQueries({ queryKey: monitoringKeys.readingStats() });
      showSuccess("Розділи успішно придбано");
      setSubscriptionSelectedIds(new Set());
      setSelectedPlanId(null);
      onPurchaseSuccess?.();
    },
    onError: (err: unknown) => {
      let msg = "Помилка застосування плану";
      if (err instanceof AxiosError && err.response?.data && typeof err.response.data === "object") {
        const d = err.response.data as Record<string, unknown>;
        if (typeof d.error === "string") msg = d.error;
        else if (typeof d === "object" && d !== null && !Array.isArray(d)) {
          const parts = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : v}`);
          if (parts.length) msg = parts.join(". ");
        }
      } else if (err instanceof Error) msg = err.message;
      showError(msg);
    },
  });

  const toggleSubscriptionChapter = (id: number) => {
    if (!canApplyPlan) return;
    setSubscriptionSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const minChapters = selectedPlan?.discount_threshold ?? 0;

  const handleChapterClick = (chapter: Chapter) => {
    if (!onRead) return;
    const needsPurchase =
      chapter.is_paid && !chapter.is_purchased && hasPrepaidForChapter;
    if (needsPurchase) {
      if (requireAuthForPurchase && !isAuthenticated) {
        openLoginModal(location.pathname);
        return;
      }
      setPurchasingChapterId(chapter.id);
      purchaseChapterMutation.mutate(chapter.id, {
        onSuccess: () => onRead(chapter),
        onSettled: () => setPurchasingChapterId(null),
      });
    } else {
      onRead(chapter);
    }
  };

  const handleApplyPlan = () => {
    if (!selectedPlanId || !bookSlug) return;
    const min = selectedPlan?.discount_threshold ?? 0;
    if (subscriptionSelectedIds.size < min) {
      showError(`Оберіть щонайменше ${min} розділів`);
      return;
    }
    applyMutation.mutate({ planId: selectedPlanId, chapterIds: Array.from(subscriptionSelectedIds) });
  };
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const grouped = useMemo(() => groupChapters(chapters, volumes), [chapters, volumes]);

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
    const maxPos = groupChapters.length;
    const num = Math.max(1, Math.min(parseInt(value, 10) || 1, maxPos));
    const currentChapter = groupChapters.find((c) => c.id === chapterId);
    if (!currentChapter || !onPositionChange) return;
    const myPos = chapterPositions[chapterId] ?? currentChapter.order;
    if (num === myPos) return;

    const updates: Record<number, number> = {};
    for (const c of groupChapters) {
      if (c.id === chapterId) continue;
      const pos = chapterPositions[c.id] ?? c.order;
      if (num < myPos && pos >= num && pos < myPos) {
        updates[c.id] = pos + 1;
      } else if (num > myPos && pos > myPos && pos <= num) {
        updates[c.id] = pos - 1;
      }
    }
    updates[chapterId] = num;
    onPositionChange(updates);
    setEditingChapterId(null);
  }

  return (
    <section className={styles.chapters} aria-label="Розділи">
      <header className={styles.chaptersHeader}>
        {canApplyPlan && (
          <div className={styles.chapterActions}>
            <div className={styles.planSelect}>
              {plans.map((p) => (
                <label key={p.id} className={styles.planSelectLabel}>
                  <input
                    type="radio"
                    name="applyPlan"
                    checked={selectedPlanId === p.id}
                    onChange={() => setSelectedPlanId(p.id)}
                  />
                  {p.discount_percent}% від {p.discount_threshold} розд.
                </label>
              ))}
            </div>
            <span className={styles.subscriptionApplyHint}>
              {selectedPlanId
                ? `Обрано ${subscriptionSelectedIds.size} (мін. ${minChapters})`
                : "Оберіть план"}
            </span>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleApplyPlan}
              loading={applyMutation.isPending}
              disabled={
                applyMutation.isPending ||
                !selectedPlanId ||
                subscriptionSelectedIds.size < minChapters
              }
            >
              Придбати обрані
            </ActionButton>
          </div>
        )}
        {isOwner && (
          <>
            <div className={styles.chapterActions}>
              {addChapterTo ? (
                <ActionButton
                  variant="primary"
                  to={addChapterTo}
                  onNavigateIntent={prefetchChapterEditor}
                >
                  Додати розділ
                </ActionButton>
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
                {isOwner &&
                  onDeleteVolume &&
                  group.volumeId !== "no-volume" &&
                  !reorderMode && (
                    <button
                      type="button"
                      className={styles.volumeDeleteBtn}
                      onClick={() =>
                        onDeleteVolume(
                          group.volumeId as number,
                          group.title,
                          group.chapters.length
                        )
                      }
                      disabled={isDeletingVolume}
                      aria-label={`Видалити том «${group.title}»`}
                    >
                      <img src={deleteIcon} alt="" className={styles.volumeDeleteIcon} aria-hidden />
                    </button>
                  )}
              </div>
              {group.chapters.length === 0 && group.volumeId !== "no-volume" ? (
                <div className={styles.chapterEmptyRow} role="row" aria-label={`${group.title} — порожній том`}>
                  <span className={styles.chapterEmptyPlaceholder}>Немає розділів</span>
                </div>
              ) : null}
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
                          checked={
                            isOwner
                              ? selectedIds.has(chapter.id)
                              : subscriptionSelectedIds.has(chapter.id)
                          }
                          onChange={() =>
                            isOwner
                              ? toggleSelected(chapter.id)
                              : toggleSubscriptionChapter(chapter.id)
                          }
                          disabled={
                            isOwner
                              ? false
                              : !(
                                  canApplyPlan &&
                                  chapter.is_paid &&
                                  !chapter.is_purchased &&
                                  chapter.price != null &&
                                  chapter.price > 0
                                )
                          }
                          aria-label={`Обрати розділ ${displayOrder}`}
                        />
                        <span className={styles.chapterCheckboxBox}>
                          {(isOwner ? selectedIds.has(chapter.id) : subscriptionSelectedIds.has(chapter.id)) && (
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
                            onClick={() => handleChapterClick(chapter)}
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
                        <button
                          type="button"
                          className={styles.chapterReadBtn}
                          onClick={() => handleChapterClick(chapter)}
                          disabled={purchasingChapterId === chapter.id}
                        >
                          <img src={readIcon} alt="" className={styles.chapterActionIcon} aria-hidden />
                          {purchasingChapterId === chapter.id ? "Покупка…" : getReadLabel(chapter)}
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
