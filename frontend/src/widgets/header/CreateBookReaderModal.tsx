import { Link } from "react-router-dom";
import { Modal } from "../../shared/Modal/Modal";
import styles from "./CreateBookReaderModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateBookReaderModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Створення книг">
      <p className={styles.text}>
        Читачі не можуть створювати книги. Щоб отримати це право, змініть тип профілю на сторінці{" "}
        <Link to="/profile" className={styles.profileLink} onClick={onClose}>
          Профіль
        </Link>
        .
      </p>
      <button type="button" className={styles.okBtn} onClick={onClose}>
        Зрозуміло
      </button>
    </Modal>
  );
}
