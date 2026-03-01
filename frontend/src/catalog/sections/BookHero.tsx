import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styles from "../styles/BookDetail.module.css";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookMeta, type MetaRow } from "./BookMeta";
import { BookActions } from "./BookActions";
import { BookRatingStars } from "./BookRatingStars";
import { fetchBookRatings } from "../../api/ratingApi";
import backBalanceIcon from "../assets/icons/back_balance.svg";
import icon18Big from "../assets/icons/18+big.svg";
import linearIcon from "../assets/icons/linear.svg";
import newTranslaterIcon from "../assets/backgrounds/new_translater.svg";

const SHORT_META_LABELS = ["Автор:", "Перекладач:", "Розділів:", "Статус перекладу:", "Країна:", "Статус випуску твору:"];
const CHIPS_META_LABELS = ["Жанр:", "Теги:", "Фендом:"];

export type BookHeroProps = {
  title: string;
  titleSecondary?: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string;
  showAgeBadge?: boolean;
  authorMarkText?: string | null;
  metaRows: MetaRow[];
  bookSlug?: string;
  ratingValue?: number | null;
  ratingCount?: number | null;
  thankAuthorLabel?: string;
  thankAuthorCoins?: string | number;
  bookId?: number;
  onBecomeTranslator?: () => void;
};

const RATINGS_STALE_TIME = 60_000;

export function BookHero({
  title,
  titleSecondary,
  coverImageUrl,
  coverImageAlt = "Обкладинка книги",
  showAgeBadge = false,
  authorMarkText,
  metaRows,
  bookSlug,
  ratingValue,
  ratingCount,
  thankAuthorLabel = "подякувати автору",
  bookId,
  onBecomeTranslator,
}: BookHeroProps) {
  const queryClient = useQueryClient();
  const slugForRatings = (bookSlug && String(bookSlug).trim()) || "";

  const { shortMetaRows, chipsMetaRows } = useMemo(() => {
    const short: MetaRow[] = [];
    const chips: MetaRow[] = [];
    for (const row of metaRows) {
      if (CHIPS_META_LABELS.includes(row.label)) chips.push(row);
      else if (SHORT_META_LABELS.includes(row.label)) short.push(row);
    }
    return { shortMetaRows: short, chipsMetaRows: chips };
  }, [metaRows]);

  const ratingsQuery = useQuery({
    queryKey: ["book-ratings", slugForRatings],
    queryFn: () => fetchBookRatings(slugForRatings),
    enabled: Boolean(slugForRatings),
    staleTime: RATINGS_STALE_TIME,
    retry: 1,
  });

  const ratingsData = ratingsQuery.data;
  const ratingsLoading = ratingsQuery.isLoading;
  const bookRating = ratingsData?.book_rating ?? { average: 0, total_votes: 0 };
  const translationRating = ratingsData?.translation_rating ?? { average: 0, total_votes: 0 };
  const userRatings = ratingsData?.user_ratings ?? null;
  const userBookRating = userRatings?.find((r) => r.rating_type === "BOOK")?.rating;
  const userTranslationRating = userRatings?.find((r) => r.rating_type === "TRANSLATION")?.rating;

  const onRatingSuccess = () => {
    if (slugForRatings) {
      queryClient.invalidateQueries({ queryKey: ["book-ratings", slugForRatings] });
    }
  };

  return (
    <section className={styles.hero} aria-labelledby="book-title-ua">
      <div className={styles.heroInner}>
        <header className={styles.heroTitleBar}>
          <h1 id="book-title-ua" className={styles.heroTitlePrimary}>
            {title}
          </h1>
          {titleSecondary ? (
            <div className={styles.heroTitleSecondaryWrap}>
              <span className={styles.heroTitleSlash} aria-hidden>/</span>
              <h2 className={styles.heroTitleSecondary}>{titleSecondary}</h2>
            </div>
          ) : null}
        </header>

        <div className={styles.heroGrid}>
          {/* 1. COVER */}
          <div className={styles.heroCover}>
            <div className={styles.coverWrap}>
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={coverImageAlt}
                  className={styles.coverImage}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div aria-hidden="true" className={styles.coverPlaceholder} />
              )}
              <img src={linearIcon} alt="" className={styles.coverLinear} aria-hidden />
              <span className={styles.coverBadgeA} aria-hidden>A</span>
              {showAgeBadge && (
                <img src={icon18Big} alt="18+" className={styles.ageBadgeIcon} />
              )}
            </div>
            <BookActions bookId={bookId} bookSlug={bookSlug} />
          </div>

          {/* 2. META SHORT */}
          <div className={styles.heroMetaShort}>
            <BookMeta rows={shortMetaRows} />
          </div>

          {/* 3. META CHIPS */}
          <div className={styles.heroMetaChips}>
            <BookMeta rows={chipsMetaRows} variant="chips" />
          </div>

          {/* 4. RATING */}
          <aside className={styles.heroRating} aria-label="Панель рейтингу та підтримки автора">
            <div className={styles.thankAuthor}>
              <div className={styles.thankAuthorIconWrap}>
                <img src={backBalanceIcon} alt="" className={styles.thankAuthorIcon} aria-hidden />
                <div className={styles.thankAuthorCoins}>
                  <p>10</p>
                  <p>FanCoins</p>
                </div>
              </div>
              <span className={styles.thankAuthorLabel}>{thankAuthorLabel}</span>
            </div>
            <div className={styles.ratingsStack}>
              {slugForRatings ? (
                <>
                  <BookRatingStars
                    bookSlug={slugForRatings}
                    ratingType="BOOK"
                    title="РЕЙТИНГ ТВОРУ:"
                    average={bookRating.average}
                    totalVotes={bookRating.total_votes}
                    userRating={userBookRating}
                    isLoading={ratingsLoading}
                    onRatingSuccess={onRatingSuccess}
                  />
                  <BookRatingStars
                    bookSlug={slugForRatings}
                    ratingType="TRANSLATION"
                    title="ЯКІСТЬ ПЕРЕКЛАДУ:"
                    average={translationRating.average}
                    totalVotes={translationRating.total_votes}
                    userRating={userTranslationRating}
                    isLoading={ratingsLoading}
                    onRatingSuccess={onRatingSuccess}
                  />
                </>
              ) : (
                <>
                  <div className={styles.ratingBox}>
                    <div className={styles.ratingTitle}>РЕЙТИНГ ТВОРУ:</div>
                    <div className={styles.ratingStars} aria-label={`Рейтинг твору: ${ratingValue ?? 0} з 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} aria-hidden="true">★</span>
                      ))}
                    </div>
                    {ratingCount ? <div className={styles.ratingHint}>({ratingCount})</div> : null}
                  </div>
                  <div className={styles.ratingBox}>
                    <div className={styles.ratingTitle}>ЯКІСТЬ ПЕРЕКЛАДУ:</div>
                    <div className={styles.ratingStars} aria-label="Якість перекладу: заглушка">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} aria-hidden="true">★</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* 5. ACTIONS — рендеримо порожній div, щоб :has() працював для центрування Авторська */}
          <div className={styles.heroActions}>
            {onBecomeTranslator ? (
              <ActionButton
                variant="outline"
                className={styles.becomeTranslatorBtn}
                onClick={onBecomeTranslator}
                leftIcon={<img src={newTranslaterIcon} alt="" width={22} height={34} />}
              >
                Стати новим перекладачем
              </ActionButton>
            ) : null}
          </div>

          {/* 6. AUTHOR MARK */}
          <div className={styles.heroAuthorMark}>
            {authorMarkText ?? "Авторська книга"}
          </div>
        </div>
      </div>
    </section>
  );
}
