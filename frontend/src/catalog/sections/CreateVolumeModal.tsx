import { useState, useEffect } from "react";
import { Modal } from "../../shared/Modal/Modal";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "../styles/MoveChapterModal.module.css";

export type CreateVolumeModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (title: string) => Promise<void>;
  isSubmitting?: boolean;
};

export function CreateVolumeModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
}: CreateVolumeModalProps) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await onConfirm(trimmed);
    onClose();
    setTitle("");
  }

  return (
    <Modal open={open} onClose={onClose} title="Створити том">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="create-volume-title">Назва тому:</label>
          <input
            id="create-volume-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новий том"
            disabled={isSubmitting}
            className={styles.input}
            autoFocus
          />
        </div>
        <div className={styles.actions}>
          <ActionButton
            type="submit"
            variant="primary"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? "Створення…" : "Створити"}
          </ActionButton>
          <ActionButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Скасувати
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
