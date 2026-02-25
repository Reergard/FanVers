import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../shared/Modal/Modal";
import styles from "../Chat.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (username: string, firstMessage?: string) => Promise<void> | void;
};

export function CreateChatModal({ open, onClose, onCreate }: Props) {
  const [username, setUsername] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setFirstMessage("");
      setSubmitting(false);
    }
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) return;

    setSubmitting(true);
    await onCreate(username, firstMessage || undefined);
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Створити чат" className={styles.createModal}>
      <form className={styles.createForm} onSubmit={submit}>
        <label className={styles.createLabel}>
          Username користувача
          <input
            className={styles.createInput}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Введіть username"
            autoFocus
          />
        </label>

        <label className={styles.createLabel}>
          Перше повідомлення (необов'язково)
          <textarea
            className={styles.createTextarea}
            value={firstMessage}
            onChange={(event) => setFirstMessage(event.target.value)}
            placeholder="Напишіть перше повідомлення..."
            rows={3}
          />
        </label>

        <div className={styles.createActions}>
          <button type="button" className={styles.createSecondaryBtn} onClick={onClose}>
            Скасувати
          </button>
          <button type="submit" className={styles.createPrimaryBtn} disabled={submitting || !username.trim()}>
            {submitting ? "Створюємо..." : "Створити"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
