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
        <span className={styles.lead}>Читачі не можуть створювати книги.</span>
        <span className={styles.instruction}>
          Щоб отримати це право, змініть тип профілю на сторінці «
          <Link to="/profile" className={styles.profileLink} onClick={onClose}>
            Профіль
          </Link>
          ».
        </span>
      </p>
      <button type="button" className={styles.okBtn} onClick={onClose}>
        Зрозуміло
      </button>
    </Modal>
  );
}
