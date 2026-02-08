import styles from "../styles/BookDetail.module.css";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { BookMeta, type MetaRow } from "./BookMeta";
import { BookActions } from "./BookActions";
import backBalanceIcon from "../assets/icons/back_balance.svg";
import icon18Big from "../assets/icons/18+big.svg";
import linearIcon from "../assets/icons/linear.svg";
import newTranslaterIcon from "../assets/backgrounds/new_translater.svg";

export type BookHeroProps = {
  title: string; // UA
  titleSecondary?: string; // EN
  coverImageUrl?: string | null;
  coverImageAlt?: string;
  showAgeBadge?: boolean;

  // То, что по дизайну справа (под рейтингами)
  authorMarkText?: string | null;

  metaRows: MetaRow[];

  // пока можно одной оценкой управлять, вторую оставим заглушкой
  ratingValue?: number | null;
  ratingCount?: number | null;

  thankAuthorLabel?: string;
  thankAuthorCoins?: string | number;

  bookId?: number;
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
  bookId,
  onTranslationSettings,
  onBecomeTranslator,
}: BookHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="book-title-ua">
      <div className={styles.heroInner}>
        {/* TITLE BAR (UA над обложкой + "/" + EN справа от обложки ниже UA) */}
        <header className={styles.heroTitleBar}>
          <h1 id="book-title-ua" className={styles.heroTitlePrimary}>
            {title}
          </h1>
          {titleSecondary ? (
            <h2 className={styles.heroTitleSecondary}>{titleSecondary}</h2>
          ) : null}
        </header>

        {/* GRID: cover | meta | right */}
        <div className={styles.heroGrid}>
          {/* LEFT: cover + actions */}
          <div className={styles.coverCol}>
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

              <img
                src={linearIcon}
                alt=""
                className={styles.coverLinear}
                aria-hidden
              />

              <span className={styles.coverBadgeA} aria-hidden>A</span>

              {showAgeBadge && (
                <img
                  src={icon18Big}
                  alt="18+"
                  className={styles.ageBadgeIcon}
                />
              )}
            </div>

            <BookActions bookId={bookId} onTranslationSettings={onTranslationSettings} />
          </div>

          {/* MIDDLE: meta + кнопка після опису жанрів/тегів */}
          <div className={styles.metaCol}>
            <BookMeta rows={metaRows} />
            <ActionButton
              variant="outline"
              className={styles.becomeTranslatorBtn}
              onClick={onBecomeTranslator}
              leftIcon={<img src={newTranslaterIcon} alt="" width={22} height={34} />}
            >
              Стати новим перекладачем
            </ActionButton>
          </div>

          {/* RIGHT: thank + ratings + author mark + button */}
          <aside className={styles.rightCol} aria-label="Панель рейтингу та підтримки автора">
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

            {/* Заглушки рейтингов (как на макете справа) */}
            <div className={styles.ratingsStack}>
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
            </div>

            <div className={styles.authorMarkRight}>{authorMarkText ?? "Авторська книга"}</div>

          </aside>
        </div>
      </div>
    </section>
  );
}
