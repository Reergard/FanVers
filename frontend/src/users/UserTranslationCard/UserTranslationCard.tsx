import { Link } from "react-router-dom";
import type { UserTranslationBook } from "../../api/catalogApi";
import badge18 from "../../assets/backgrounds/18+.svg";
import coverPlaceholder from "../../assets/1SR-gLCHT4s.jpg";
import styles from "./UserTranslationCard.module.css";

function getImageUrl(book: UserTranslationBook): string {
  const img = book.image;
  if (!img) return "";
  if (img.startsWith("http")) return img;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}${img}` : img;
}

function formatStat(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

type Props = {
  book: UserTranslationBook;
};

export function UserTranslationCard({ book }: Props) {
  const slug = book.slug;
  const imageUrl = getImageUrl(book) || coverPlaceholder;

  const cardContent = (
    <article className={styles.card}>
      <div className={styles.coverWrap}>
        <img
          className={styles.cover}
          src={imageUrl}
          alt={book.title || "Обкладинка"}
          loading="lazy"
          decoding="async"
        />
        {book.adult_content && (
          <img
            className={styles.badge18}
            src={badge18}
            alt="18+"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className={styles.cornerA} aria-hidden="true">
          A
        </div>
      </div>
      <h3 className={styles.title}>{book.title || "Без назви"}</h3>
      <div className={styles.metaBlock}>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Дата створення</span>
          <span className={styles.metaValue}>{book.created_at ?? "—"}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Дата останньої активності</span>
          <span className={styles.metaValue}>{book.last_updated ?? "—"}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Переглядів за день</span>
          <span className={styles.metaValue}>{formatStat(book.daily_views)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Дохід за день</span>
          <span className={styles.metaValue}>{formatStat(book.daily_income)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Дохід за місяць</span>
          <span className={styles.metaValue}>{formatStat(book.monthly_income)}</span>
        </div>
      </div>
    </article>
  );

  if (slug) {
    return (
      <Link to={`/books/${slug}`} className={styles.cardLink}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={styles.cardNoLink} title="Посилання недоступне">
      {cardContent}
    </div>
  );
}
