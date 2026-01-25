import styles from "./BookAdCard.module.css";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import ellipseBg from "../../assets/backgrounds/Ellipse_for_book.svg";

type Props = {
  coverSrc: string;
  title: string;
  description: string;
  isAdult?: boolean;
  onRead?: () => void;
  adultBadgeSrc: string; // 18+.svg
};

export function BookAdCard({
  coverSrc,
  title,
  description,
  isAdult = true,
  onRead,
  adultBadgeSrc,
}: Props) {
  return (
    <article 
      className={styles.card}
      style={{ "--ellipse-bg": `url(${ellipseBg})` } as React.CSSProperties}
    >
      <div className={styles.coverWrap}>
        <img className={styles.cover} src={coverSrc} alt={title} loading="lazy" decoding="async" />

        {isAdult && (
          <img className={styles.badge18} src={adultBadgeSrc} alt="18+" loading="lazy" decoding="async" />
        )}

        <div className={styles.cornerA} aria-hidden="true">
          A
        </div>
      </div>

      <h3 className={styles.title}>{title}</h3>

      <p className={styles.desc}>{description}</p>

      <div className={styles.actions}>
        <ActionButton onClick={onRead} ariaLabel={`Читати: ${title}`}>
          Читати
        </ActionButton>
      </div>
    </article>
  );
}
