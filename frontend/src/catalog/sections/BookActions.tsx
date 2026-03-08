import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookmarkButton } from "../../bookmarks/BookmarkButton";
import styles from "../styles/BookDetail.module.css";

type BookActionsProps = {
  bookId?: number;
  bookSlug?: string;
  /** Показувати кнопку Налаштування тільки власникам книги */
  showSettings?: boolean;
};

export function BookActions({ bookId, bookSlug, showSettings = false }: BookActionsProps) {
  return (
    <div className={styles.coverActions}>
      {bookId != null ? (
        <BookmarkButton bookId={bookId} />
      ) : (
        <ActionButton variant="primary" disabled>
          В закладки
        </ActionButton>
      )}
      {showSettings && (
        <ActionButton
          variant="primary"
          to={bookSlug ? `/books/${bookSlug}/settings` : undefined}
          disabled={!bookSlug}
          className={styles.settingsBtn}
        >
          Налаштування
        </ActionButton>
      )}
    </div>
  );
}
