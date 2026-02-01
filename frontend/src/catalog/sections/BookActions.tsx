import styles from "../styles/BookDetail.module.css";

type BookActionsProps = {
  onBookmark?: () => void;
  onTranslationSettings?: () => void;
};

export function BookActions({ onBookmark, onTranslationSettings }: BookActionsProps) {
  return (
    <div className={styles.coverActions}>
      <button type="button" onClick={onBookmark}>
        В закладки
      </button>
      <button type="button" onClick={onTranslationSettings}>
        Налаштування перекладу
      </button>
    </div>
  );
}
