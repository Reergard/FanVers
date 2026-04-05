import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../shared/Modal/Modal";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { extractUserMessage } from "../shared/utils/errorUtils";
import {
  ERROR_REPORT_ERROR_TYPES,
  type ErrorReportErrorType,
  sendErrorReport,
} from "../api/errorReportApi";
import styles from "./ModalErrorReport.module.css";

export type ModalErrorReportProps = {
  show: boolean;
  onHide: () => void;
  bookId: number | null;
  chapterId: number | null;
  bookTitle: string;
  chapterTitle: string;
  selectedText: string;
  /** Після успішної відправки — скинути локальний стан виділення у батьківському компоненті */
  onSubmitted?: () => void;
};

const TYPE_LABELS: Record<ErrorReportErrorType, string> = {
  typo: "Опечатка",
  translation: "Переклад / формулювання",
  punctuation: "Пунктуація",
  other: "Інше",
};

export function ModalErrorReport({
  show,
  onHide,
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
  selectedText,
  onSubmitted,
}: ModalErrorReportProps) {
  const { showSuccess, showError } = useNotification();
  const [errorType, setErrorType] = useState<ErrorReportErrorType>("typo");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show) {
      setErrorType("typo");
      setComment("");
      setSubmitting(false);
    }
  }, [show]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (bookId == null || chapterId == null || bookId <= 0 || chapterId <= 0) {
      showError("Немає даних розділу. Оновіть сторінку та спробуйте ще раз.");
      return;
    }
    const fragment = selectedText.trim();
    if (!fragment) {
      showError("Оберіть фрагмент тексту з помилкою.");
      return;
    }

    setSubmitting(true);
    try {
      await sendErrorReport({
        book_id: bookId,
        chapter_id: chapterId,
        selected_text: fragment,
        error_type: errorType,
        comment: comment.trim() || undefined,
      });
      showSuccess("Повідомлення надіслано перекладачу. Дякуємо!");
      onSubmitted?.();
      onHide();
    } catch (err) {
      showError(extractUserMessage(err, "Не вдалося надіслати повідомлення."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={show} onClose={onHide} title="Повідомити про помилку">
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.meta}>
          <strong>{bookTitle}</strong>
          {" · "}
          {chapterTitle}
        </p>

        <div>
          <span className={styles.fragmentLabel}>Фрагмент з помилкою</span>
          <div className={styles.fragmentBox} role="region" aria-label="Виділений текст">
            {selectedText.trim() || "—"}
          </div>
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Тип помилки</legend>
          <div className={styles.radioList}>
            {ERROR_REPORT_ERROR_TYPES.map((value) => (
              <label key={value} className={styles.radioRow}>
                <input
                  type="radio"
                  name="error_type"
                  value={value}
                  checked={errorType === value}
                  onChange={() => setErrorType(value)}
                />
                <span>{TYPE_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.textareaLabel}>
          Коментар (необов’язково)
          <textarea
            className={styles.textarea}
            value={comment}
            onChange={(ev) => setComment(ev.target.value)}
            placeholder="Наприклад, як краще написати…"
            maxLength={2000}
            rows={4}
          />
        </label>

        <div className={styles.actions}>
          <ActionButton type="button" variant="outline" onClick={onHide} disabled={submitting}>
            Скасувати
          </ActionButton>
          <ActionButton
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={submitting || !selectedText.trim()}
          >
            Надіслати
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
