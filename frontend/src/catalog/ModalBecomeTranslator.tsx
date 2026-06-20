import { useState } from "react";
import { Modal } from "../shared/Modal/Modal";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage } from "../shared/utils/errorUtils";
import { applyBecomeTranslator } from "../api/catalogApi";
import styles from "./ModalBecomeTranslator.module.css";

export type ModalBecomeTranslatorProps = {
  open: boolean;
  onClose: () => void;
  bookSlug: string;
  bookTitle: string;
};

export function ModalBecomeTranslator({
  open,
  onClose,
  bookSlug,
  bookTitle,
}: ModalBecomeTranslatorProps) {
  const { showSuccessAutoClose, showError } = useNotification();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await applyBecomeTranslator(bookSlug);
      showSuccessAutoClose(
        `Ваш запит на переклад «${bookTitle}» успішно надіслано. Очікуйте на рішення.`
      );
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        showError("Ви вже подали заявку на цю книгу.");
      } else {
        showError(extractUserMessage(err, "Не вдалося надіслати заявку."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Підтвердження">
      <p className={styles.intro}>
        Ви впевнені, що готові взяти переклад твору «<strong>{bookTitle}</strong>»
        на себе?
      </p>
      <p className={styles.hint}>
        Після схвалення адміністрацією вам буде надано 5 днів для публікації
        нових розділів.
      </p>
      <div className={styles.actions}>
        <ActionButton variant="outline" onClick={onClose} disabled={submitting}>
          Скасувати
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={handleConfirm}
          loading={submitting}
          disabled={submitting}
        >
          Підтвердити
        </ActionButton>
      </div>
    </Modal>
  );
}
