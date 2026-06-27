import DOMPurify from "dompurify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Container } from "../shared/Container";
import { Icon } from "../shared/Icon";
import { SvgSpriteBook } from "../shared/SvgSpriteBook";
import { BookCommentsContainer } from "./sections/BookCommentsContainer";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { ModalErrorReport } from "./ModalErrorReport";
import { useReadingProgress } from "./hooks/useReadingProgress";
import styles from "./ChapterDetail.module.css";

const prevLabel = "Попередній розділ";
const nextLabel = "Наступний розділ";

const STYLE_DECL_RE =
  /^\s*(color|font-size|font-family|text-align|text-decoration|background-color)\s*:/i;

let readerPurifyStyleHookInstalled = false;
function ensureReaderPurifyStyleHook() {
  if (readerPurifyStyleHookInstalled) return;
  readerPurifyStyleHookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLElement) || !node.hasAttribute("style")) return;
    const style = node.getAttribute("style") || "";
    const parts = style.split(";").filter((p) => {
      const t = p.trim();
      return t && STYLE_DECL_RE.test(t);
    });
    if (parts.length) node.setAttribute("style", parts.join(";"));
    else node.removeAttribute("style");
  });
}
ensureReaderPurifyStyleHook();

const READER_HTML_PURIFY = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "b",
    "i",
    "em",
    "strong",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "mark",
    "hr",
    "span",
    "a",
    "table",
    "tr",
    "td",
    "th",
    "thead",
    "tbody",
    "img",
    "blockquote",
    "sup",
    "sub",
    "s",
    "del",
  ],
  ALLOWED_ATTR: [
    "class",
    "href",
    "src",
    "alt",
    "title",
    "colspan",
    "rowspan",
    "style",
    "target",
    "rel",
    "width",
    "height",
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
};

/** Метадані розділу для репорту помилки (узгоджено з завантаженими даними каталогу). */
export type ChapterReaderMeta = {
  title: string;
  book_title: string;
  id: number | null;
  book_id: number | null;
};

type ChapterDetailProps = {
  bookSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterContentHtml: string;
  prevChapterSlug?: string | null;
  nextChapterSlug?: string | null;
  navigationReady?: boolean;
  isOwner: boolean;
  onNavigateToChapter?: (targetChapterSlug: string) => void;
  chapterMeta: ChapterReaderMeta;
};

function selectionInsideReader(readerEl: HTMLElement | null): boolean {
  if (!readerEl) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  return readerEl.contains(range.commonAncestorContainer);
}

export default function ChapterDetail(props: ChapterDetailProps) {
  return <ChapterDetailImpl key={props.chapterSlug} {...props} />;
}

function ChapterDetailImpl({
  bookSlug,
  chapterSlug,
  chapterTitle,
  chapterContentHtml,
  prevChapterSlug = null,
  nextChapterSlug = null,
  navigationReady = false,
  isOwner,
  onNavigateToChapter,
  chapterMeta,
}: ChapterDetailProps) {
  const location = useLocation();
  const { isAuthenticated, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();
  const { showError } = useNotification();

  const readerRef = useRef<HTMLDivElement>(null);

  const chapterId = chapterMeta.id;
  useReadingProgress({
    chapterId,
    enabled:
      isAuthenticated &&
      authReady &&
      chapterId != null &&
      chapterId > 0,
  });

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const stableMouseUp = useCallback(() => {
    const readerEl = readerRef.current;
    if (!readerEl) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text) return;
    if (!selectionInsideReader(readerEl)) return;
    setSelectedText(text);
  }, []);

  const cancelSelectionMode = useCallback((): void => {
    setIsSelectionMode(false);
    document.removeEventListener("mouseup", stableMouseUp);
  }, [stableMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mouseup", stableMouseUp);
    };
  }, [stableMouseUp]);

  useEffect(() => {
    if (!isSelectionMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelSelectionMode();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelectionMode, cancelSelectionMode]);

  const chapterMetaReady =
    chapterMeta.id != null &&
    chapterMeta.book_id != null &&
    chapterMeta.id > 0 &&
    chapterMeta.book_id > 0;

  const handleStartSelection = (): void => {
    if (!isAuthenticated) {
      openLoginModal(location.pathname);
      return;
    }
    if (!chapterMetaReady) {
      showError("Зачекайте завантаження розділу і спробуйте ще раз.");
      return;
    }
    setIsSelectionMode(true);
    document.addEventListener("mouseup", stableMouseUp);
  };

  const confirmSelectedText = (): void => {
    const text = selectedText.trim();
    if (!text) {
      showError("Спочатку виділіть текст у розділі.");
      return;
    }
    setShowErrorModal(true);
    cancelSelectionMode();
  };

  const prevTo = prevChapterSlug
    ? `/books/${bookSlug}/chapters/${prevChapterSlug}`
    : `/books/${bookSlug}`;
  const nextTo = nextChapterSlug
    ? `/books/${bookSlug}/chapters/${nextChapterSlug}`
    : `/books/${bookSlug}`;

  const readerHtml = useMemo(() => {
    const fallback = `<p class="${styles.p}">Зміст глави відсутній.</p>`;
    const raw = chapterContentHtml?.trim() ? chapterContentHtml : fallback;
    return DOMPurify.sanitize(raw, READER_HTML_PURIFY);
  }, [chapterContentHtml]);

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

          {nextChapterSlug ? (
            <Link
              className={`${styles.navBtn} ${styles.navBtnRight}`}
              to={nextTo}
              aria-label={nextLabel}
              onClick={(e) => {
                if (!onNavigateToChapter) return;
                e.preventDefault();
                onNavigateToChapter(nextChapterSlug);
              }}
            >
              <Icon name="chapter-next-frame" className={styles.navBtnIcon} aria-hidden />
            </Link>
          ) : navigationReady ? null : (
            <span
              className={`${styles.navBtn} ${styles.navBtnRight} ${styles.navBtnPlaceholder}`}
              aria-hidden
            />
          )}
        </Container>
      </header>

      {/* Dotted divider — з спрайта sprite-book (точки-лінії) */}
      <Icon name="chapter-dots" className={styles.dottedDivider} role="separator" aria-hidden />

      {/* READER */}
      <section
        className={`${styles.reader} ${isSelectionMode ? styles.readerSelecting : ""}`}
        aria-label="Текст розділу"
      >
        <div
          ref={readerRef}
          className={styles.reader__inner}
          dangerouslySetInnerHTML={{ __html: readerHtml }}
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

            {nextChapterSlug ? (
              <Link
                className={`${styles.navBtn} ${styles.navBtnRight}`}
                to={nextTo}
                aria-label={nextLabel}
                onClick={(e) => {
                  if (!onNavigateToChapter) return;
                  e.preventDefault();
                  onNavigateToChapter(nextChapterSlug);
                }}
              >
                <Icon name="chapter-next-frame" className={styles.navBtnIcon} aria-hidden />
              </Link>
            ) : navigationReady ? null : (
              <span
                className={`${styles.navBtn} ${styles.navBtnRight} ${styles.navBtnPlaceholder}`}
                aria-hidden
              />
            )}
          </div>

          <div className={styles.reportRow}>
            {!isSelectionMode ? (
              <div className={styles.reportBtnWrap}>
                <span className={styles.reportBtnFrame} aria-hidden="true">
                  <Icon name="report-error-frame" width="100%" height="100%" />
                </span>
                <button
                  className={styles.reportBtn}
                  type="button"
                  onClick={handleStartSelection}
                  aria-label="Повідомити про помилку"
                  title="Повідомити про помилку"
                />
              </div>
            ) : (
              <div className={styles.selectionMode}>
                {!selectedText.trim() && (
                  <p className={styles.instructionsText}>
                    Виділіть будь ласка текст, у якому ви знайшли помилку!
                  </p>
                )}
                <div className={styles.selectionActions}>
                  {selectedText.trim() ? (
                    <ActionButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={confirmSelectedText}
                    >
                      Підтвердити вибраний текст
                    </ActionButton>
                  ) : null}
                  <ActionButton type="button" variant="outline" size="sm" onClick={cancelSelectionMode}>
                    Скасувати
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        </Container>
      </footer>

      <ModalErrorReport
        show={showErrorModal}
        onHide={() => setShowErrorModal(false)}
        bookId={chapterMeta.book_id}
        chapterId={chapterMeta.id}
        bookTitle={chapterMeta.book_title}
        chapterTitle={chapterMeta.title}
        selectedText={selectedText}
        onSubmitted={() => setSelectedText("")}
      />

      {/* COMMENTS — дизайн 1:1 як у BookComments (той самий компонент і стилі) */}
      <section className={styles.commentsWrap} aria-label="Коментарі до розділу">
        <BookCommentsContainer type="chapter" slug={chapterSlug} bookSlug={bookSlug} isOwner={isOwner} />
      </section>
    </article>
  );
}
