import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookmarkButton } from "../../bookmarks/BookmarkButton";
import styles from "../styles/BookDetail.module.css";
import settingsIcon from "../assets/backgrounds/settings.svg";

type BookActionsProps = {
  bookId?: number;
  onTranslationSettings?: () => void;
};

export function BookActions({ bookId, onTranslationSettings }: BookActionsProps) {
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
        variant="outline"
        onClick={onTranslationSettings}
        leftIcon={<img src={settingsIcon} alt="" width={20} height={20} />}
      >
        Налаштування перекладу
      </ActionButton>
    </div>
  );
}
