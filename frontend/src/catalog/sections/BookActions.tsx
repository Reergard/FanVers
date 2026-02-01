import { ActionButton } from "../../shared/ActionButton/ActionButton";
import styles from "../styles/BookDetail.module.css";
import settingsIcon from "../assets/backgrounds/settings.svg";

type BookActionsProps = {
  onBookmark?: () => void;
  onTranslationSettings?: () => void;
};

export function BookActions({ onBookmark, onTranslationSettings }: BookActionsProps) {
  return (
    <div className={styles.coverActions}>
      <ActionButton variant="primary" onClick={onBookmark}>В закладки</ActionButton>
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
