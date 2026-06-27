import { Modal } from "../../shared/Modal/Modal";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "../styles/MoveChapterModal.module.css";

function formatChaptersCount(count: number): string {
  if (count === 1) return "1 розділ";
  if (count >= 2 && count <= 4) return `${count} розділи`;
  return `${count} розділів`;
}

export type DeleteVolumeModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  volumeTitle: string;
  chaptersCount: number;
  isSubmitting?: boolean;
};

export function DeleteVolumeModal({
  open,
  onClose,
  onConfirm,
  volumeTitle,
  chaptersCount,
  isSubmitting = false,
}: DeleteVolumeModalProps) {
  async function handleConfirm() {
    await onConfirm();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Видалити том">
      <div className={styles.form}>
        <p className={styles.chapterName}>
          Ви впевнені, що хочете видалити том «{volumeTitle}»?
        </p>
        {chaptersCount > 0 ? (
          <p className={styles.chapterName}>
            У цьому томі {formatChaptersCount(chaptersCount)}. Усі розділи будуть видалені
            безповоротно разом із їхнім вмістом і файлами.
          </p>
        ) : null}
        <p className={styles.chapterName}>Цю дію неможливо скасувати.</p>
        <div className={styles.actions}>
          <ActionButton
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? "Видалення…" : "Видалити"}
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
      </div>
    </Modal>
  );
}
