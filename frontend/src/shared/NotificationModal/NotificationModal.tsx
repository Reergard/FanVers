import { Modal } from "../Modal/Modal";
import { ActionButton } from "../ActionButton/ActionButton";
import styles from "./NotificationModal.module.css";

type NotificationType = "error" | "success" | "info" | "warning";

type Props = {
  open: boolean;
  onClose: () => void;
  message: string;
  type?: NotificationType;
};

export function NotificationModal({ open, onClose, message, type = "error" }: Props) {
  const getTitle = () => {
    switch (type) {
      case "error":
        return "Помилка";
      case "success":
        return "Успіх";
      case "info":
        return "Інформація";
      case "warning":
        return "Попередження";
      default:
        return "Повідомлення";
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={getTitle()}>
      <div className={`${styles.content} ${styles[type]}`}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <ActionButton onClick={onClose} ariaLabel="Закрити">
            Зрозуміло
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
