import styles from "./BookAdCard.module.css";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { Icon } from "../../shared/Icon";
import ellipseBg from "../../assets/backgrounds/Ellipse_for_book.svg";

export type BookAdCardVariant = "ad" | "bookmark";

type Props = {
  coverSrc: string;
  title: string;
  description?: string;
  isAdult?: boolean;
  onRead?: () => void;
  adultBadgeSrc: string; // 18+.svg
  /** ad = реклама (еліпс, опис). bookmark = закладки (компактно, іконка на обкладинці) */
  variant?: BookAdCardVariant;
};

export function BookAdCard({
  coverSrc,
  title,
  description = "",
  isAdult = true,
  onRead,
  adultBadgeSrc,
  variant = "ad",
}: Props) {
  const isBookmark = variant === "bookmark";
  return (
    <article
      className={`${styles.card} ${isBookmark ? styles.variantBookmark : ""}`}
      style={isBookmark ? undefined : { "--ellipse-bg": `url(${ellipseBg})` } as React.CSSProperties}
    >
      <div className={`${styles.coverWrap} ${isBookmark ? styles.variantBookmarkCover : ""}`}>
        <img
          className={styles.cover}
          src={coverSrc}
          alt={title}
          loading="lazy"
          decoding="async"
        />
        {isAdult && (
          <img
            className={styles.badge18}
            src={adultBadgeSrc}
            alt="18+"
            loading="lazy"
            decoding="async"
          />
        )}
        {isBookmark ? (
          <span className={styles.bookmarkIcon} aria-hidden>
            <Icon name="zakladki" />
          </span>
        ) : (
          <div className={styles.cornerA} aria-hidden="true">
            A
          </div>
        )}
      </div>

      <h3 className={styles.title}>{title}</h3>

      {!isBookmark && <p className={styles.desc}>{description}</p>}

      <div className={styles.actions}>
        <ActionButton
          variant="default"
          onClick={onRead}
          ariaLabel={`Читати: ${title}`}
        >
          читати
        </ActionButton>
      </div>
    </article>
  );
}
