import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookmarkButton } from "../../bookmarks/BookmarkButton";
import styles from "../styles/BookDetail.module.css";

type BookActionsProps = {
  bookId?: number;
  bookSlug?: string;
};

export function BookActions({ bookId, bookSlug }: BookActionsProps) {
  return (
    <div className={styles.coverActions}>
      {bookId != null ? (
        <BookmarkButton bookId={bookId} />
      ) : (
        <ActionButton variant="primary" disabled>
          В закладки
        </ActionButton>
      )}
      <ActionButton
        variant="primary"
        to={bookSlug ? `/books/${bookSlug}/settings` : undefined}
        disabled={!bookSlug}
        className={styles.settingsBtn}
      >
        Налаштування
      </ActionButton>
    </div>
  );
}
