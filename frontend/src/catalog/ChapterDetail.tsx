import { Link } from "react-router-dom";
import { Container } from "../shared/Container";
import { Icon } from "../shared/Icon";
import { SvgSpriteBook } from "../shared/SvgSpriteBook";
import { BookCommentsContainer } from "./sections/BookCommentsContainer";
import styles from "./ChapterDetail.module.css";

const prevLabel = "Попередній розділ";
const nextLabel = "Наступний розділ";

type ChapterDetailProps = {
  bookSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterContentHtml: string;
  prevChapterSlug?: string | null;
  nextChapterSlug?: string | null;
  isOwner: boolean;
  onNavigateToChapter?: (targetChapterSlug: string) => void;
};

export default function ChapterDetail({
  bookSlug,
  chapterSlug,
  chapterTitle,
  chapterContentHtml,
  prevChapterSlug = null,
  nextChapterSlug = null,
  isOwner,
  onNavigateToChapter,
}: ChapterDetailProps) {
  const prevTo = prevChapterSlug
    ? `/books/${bookSlug}/chapters/${prevChapterSlug}`
    : `/books/${bookSlug}`;
  const nextTo = nextChapterSlug
    ? `/books/${bookSlug}/chapters/${nextChapterSlug}`
    : `/books/${bookSlug}`;

  return (
    <article className={styles.page}>
      <SvgSpriteBook />

      {/* TOP NAV */}
      <header className={styles.chapterNav} aria-label="Навігація розділу (верх)">
        <Container className={styles.chapterNav__inner}>
          <Link
            className={styles.navBtn}
            to={prevTo}
            aria-label={prevChapterSlug ? prevLabel : "До книги"}
            onClick={(e) => {
              if (!prevChapterSlug || !onNavigateToChapter) return;
              e.preventDefault();
              onNavigateToChapter(prevChapterSlug);
            }}
          >
            <Icon name="chapter-prev-frame" className={styles.navBtnIcon} aria-hidden />
          </Link>

          <div className={styles.navTitle} aria-label="Назва розділу">
            <Icon name="chapter-title-ornament" className={styles.navTitleFrame} aria-hidden />
            <h1 className={styles.navTitle__text}>{chapterTitle}</h1>
          </div>

          <Link
            className={`${styles.navBtn} ${styles.navBtnRight}`}
            to={nextTo}
            aria-label={nextLabel}
            onClick={(e) => {
              if (!nextChapterSlug || !onNavigateToChapter) return;
              e.preventDefault();
              onNavigateToChapter(nextChapterSlug);
            }}
          >
            <Icon name="chapter-next-frame" className={styles.navBtnIcon} aria-hidden />
          </Link>
        </Container>
      </header>

      {/* Dotted divider — з спрайта sprite-book (точки-лінії) */}
      <Icon name="chapter-dots" className={styles.dottedDivider} role="separator" aria-hidden />

      {/* READER */}
      <section className={styles.reader} aria-label="Текст розділу">
        <div
          className={styles.reader__inner}
          dangerouslySetInnerHTML={{
            __html: chapterContentHtml || `<p class="${styles.p}">Зміст глави відсутній.</p>`,
          }}
        />
      </section>

      {/* BOTTOM NAV */}
      <footer className={styles.chapterFooter} aria-label="Навігація розділу (низ)">
        <Container className={styles.chapterFooter__inner}>
          <div className={styles.chapterFooter__row}>
            <Link
              className={styles.navBtn}
              to={prevTo}
              aria-label={prevChapterSlug ? prevLabel : "До книги"}
              onClick={(e) => {
                if (!prevChapterSlug || !onNavigateToChapter) return;
                e.preventDefault();
                onNavigateToChapter(prevChapterSlug);
              }}
            >
              <Icon name="chapter-prev-frame" className={styles.navBtnIcon} aria-hidden />
            </Link>

            <div className={styles.navTitle} aria-hidden="true">
              <Icon name="chapter-title-ornament" className={styles.navTitleFrame} aria-hidden />
              <div className={styles.navTitle__text}>{chapterTitle}</div>
            </div>

            <Link
              className={`${styles.navBtn} ${styles.navBtnRight}`}
              to={nextTo}
              aria-label={nextLabel}
              onClick={(e) => {
                if (!nextChapterSlug || !onNavigateToChapter) return;
                e.preventDefault();
                onNavigateToChapter(nextChapterSlug);
              }}
            >
              <Icon name="chapter-next-frame" className={styles.navBtnIcon} aria-hidden />
            </Link>
          </div>

          <div className={styles.reportRow}>
            <div className={styles.reportBtnWrap}>
              <span className={styles.reportBtnFrame} aria-hidden="true">
                <Icon name="report-error-frame" width="100%" height="100%" />
              </span>
              <button className={styles.reportBtn} type="button" aria-label="Повідомити про помилку" />
            </div>
          </div>
        </Container>
      </footer>

      {/* COMMENTS — дизайн 1:1 як у BookComments (той самий компонент і стилі) */}
      <section className={styles.commentsWrap} aria-label="Коментарі до розділу">
        <BookCommentsContainer type="chapter" slug={chapterSlug} isOwner={isOwner} />
      </section>
    </article>
  );
}
