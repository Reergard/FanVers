import React, { useEffect, useRef } from "react";
import { Modal } from "../Modal/Modal";
import styles from "./NotificationModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  message: string;
  /** Час у мілісекундах, після якого вікно закривається */
  autoCloseMs: number;
};

/**
 * Уведомлення без кнопок: без крестика і без «Зрозуміло»,
 * закривається автоматично через autoCloseMs.
 * Використовується, зокрема, для успіху створення глави.
 */
export function AutoCloseNotificationModal({
  open,
  onClose,
  message,
  autoCloseMs,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || autoCloseMs <= 0) return;

    timerRef.current = setTimeout(() => {
      onClose();
      timerRef.current = null;
    }, autoCloseMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, autoCloseMs, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Успіх" showCloseButton={false}>
      <div className={`${styles.content} ${styles.success}`}>
        <p className={styles.message}>{message}</p>
      </div>
    </Modal>
  );
}
