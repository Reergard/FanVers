import styles from "../styles/BookDetail.module.css";
import { BookMeta, type MetaRow } from "./BookMeta";
import { BookActions } from "./BookActions";

export type BookHeroProps = {
  title: string;
  titleSecondary?: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string;
  showAgeBadge?: boolean;
  authorMarkText?: string | null;
  metaRows: MetaRow[];
  ratingValue?: number | null;
  ratingCount?: number | null;
  thankAuthorLabel?: string;
  thankAuthorCoins?: string | number;
  onBookmark?: () => void;
  onTranslationSettings?: () => void;
  onBecomeTranslator?: () => void;
};

export function BookHero({
  title,
  titleSecondary,
  coverImageUrl,
  coverImageAlt = "Обкладинка книги",
  showAgeBadge = false,
  authorMarkText,
  metaRows,
  ratingValue,
  ratingCount,
  thankAuthorLabel = "подякувати автору",
  thankAuthorCoins,
  onBookmark,
  onTranslationSettings,
  onBecomeTranslator,
}: BookHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="book-title">
      <div className={styles.heroGrid}>
        <div className={styles.coverCol}>
          <div className={styles.coverWrap}>
            {coverImageUrl ? (
              <img src={coverImageUrl} alt={coverImageAlt} loading="eager" decoding="async" />
            ) : (
              <div aria-hidden="true" className={styles.coverPlaceholder} />
            )}
            {showAgeBadge && <span className={styles.ageBadge} aria-label="18+">18+</span>}
            {authorMarkText != null && authorMarkText !== "" && (
              <span className={styles.authorMark}>{authorMarkText}</span>
            )}
          </div>

          <BookActions onBookmark={onBookmark} onTranslationSettings={onTranslationSettings} />
        </div>

        <div className={styles.infoCol}>
          <header className={styles.titleBlock}>
            <h1 id="book-title">{title}</h1>
            {titleSecondary != null && titleSecondary !== "" && (
              <h2>{titleSecondary}</h2>
            )}
          </header>

          <BookMeta rows={metaRows} />

          {(ratingValue != null || ratingCount != null) && (
            <div className={styles.ratingBlock}>
              <span>РЕЙТИНГ ТВОРУ:</span>
              <div className={styles.ratingStars} aria-label={`Рейтинг: ${ratingValue ?? 0} з 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} aria-hidden="true">
                    ★
                  </span>
                ))}
              </div>
              {ratingCount != null && ratingCount > 0 && (
                <span>({ratingCount} оцінки)</span>
              )}
            </div>
          )}

          <div className={styles.ctaBlock}>
            {thankAuthorCoins != null && (
              <div className={styles.thankAuthor}>
                <strong>{thankAuthorCoins} FanCoins</strong>
                <span>{thankAuthorLabel}</span>
              </div>
            )}
            <button type="button" onClick={onBecomeTranslator}>
              Стати новим перекладачем
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
