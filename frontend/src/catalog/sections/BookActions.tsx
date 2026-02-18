import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookmarkButton } from "../../bookmarks/BookmarkButton";
import styles from "../styles/BookDetail.module.css";

type BookActionsProps = {
  bookId?: number;
};

export function BookActions({ bookId }: BookActionsProps) {
  return (
    <div className={styles.coverActions}>
      {bookId != null ? (
        <BookmarkButton bookId={bookId} />
      ) : (
        <ActionButton variant="primary" disabled>
          В закладки
        </ActionButton>
      )}
    </div>
  );
}
