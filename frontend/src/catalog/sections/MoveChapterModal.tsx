import { useState, useEffect } from "react";
import { Modal } from "../../shared/Modal/Modal";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import type { Chapter, Volume } from "../../api/catalogApi";
import styles from "../styles/MoveChapterModal.module.css";

export type MoveChapterModalProps = {
  open: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  volumes: Volume[];
  onConfirm: (toVolumeId: number | null, toOrder?: number) => Promise<void>;
  isSubmitting?: boolean;
};

export function MoveChapterModal({
  open,
  onClose,
  chapter,
  volumes,
  onConfirm,
  isSubmitting = false,
}: MoveChapterModalProps) {
  const [toVolumeId, setToVolumeId] = useState<string>("");
  const [toOrder, setToOrder] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setToVolumeId("");
      setToOrder("");
    }
  }, [open]);

  const currentVolumeId = chapter?.volume ?? chapter?.volumeId ?? null;
  const targetOptions = [
    { value: "", label: "— Оберіть том —" },
    ...(currentVolumeId !== null ? [{ value: "null", label: "Розділи без тому" }] : []),
    ...volumes
      .filter((v) => v.id !== currentVolumeId)
      .map((v) => ({
        value: String(v.id),
        label: v.title ?? `Том ${v.id}`,
      })),
  ];
  const hasValidTargets = targetOptions.some((o) => o.value !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapter) return;
    const volId = toVolumeId === "null" ? null : toVolumeId ? Number(toVolumeId) : null;
    if (volId === null && toVolumeId !== "null") return;
    const order = toOrder.trim() ? parseInt(toOrder, 10) : undefined;
    if (order != null && (isNaN(order) || order < 1)) return;
    await onConfirm(volId, order);
    onClose();
    setToVolumeId("");
    setToOrder("");
  }

  if (!chapter) return null;

  return (
    <Modal open={open} onClose={onClose} title="Перемістити розділ">
      <form onSubmit={handleSubmit} className={styles.form}>
        {!hasValidTargets && (
          <p className={styles.chapterName} role="alert">
            Немає інших томів для переміщення. Створіть том або перемістіть розділ у «Розділи без тому».
          </p>
        )}
        <p className={styles.chapterName}>«{chapter.title}»</p>
        <div className={styles.field}>
          <label htmlFor="move-volume">У том:</label>
          <select
            id="move-volume"
            value={toVolumeId}
            onChange={(e) => setToVolumeId(e.target.value)}
            required
            disabled={isSubmitting || !hasValidTargets}
            className={styles.select}
          >
            {targetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="move-order">Позиція (необовʼязково, за замовчуванням — в кінець):</label>
          <input
            id="move-order"
            type="number"
            min={1}
            value={toOrder}
            onChange={(e) => setToOrder(e.target.value)}
            placeholder="В кінець"
            disabled={isSubmitting}
            className={styles.input}
          />
        </div>
        <div className={styles.actions}>
          <ActionButton type="submit" variant="primary" disabled={isSubmitting || !toVolumeId || !hasValidTargets}>
            {isSubmitting ? "Переміщення…" : "Перемістити"}
          </ActionButton>
          <ActionButton type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Скасувати
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
