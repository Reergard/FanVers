import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import type { BookCardBook } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import {
  getBooksRecentUpdates,
  getBookNewsCoverUrl,
  getRecentUpdateCardCaption,
  type BookRecentUpdateItem,
} from "../api/mainApi";
import "./HomePage.module.css";

import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";

const BOOKS_RECENT_STALE_MS = 5 * 60 * 1000;
const INITIAL_VISIBLE_DESKTOP = 20;
const INITIAL_VISIBLE_MOBILE = 10;

/** Індекси початку «вікна» каруселі (узгоджено з кроком prev/next). */
function getRecentUpdatePageStarts(bookCount: number, cardsPerView: number): number[] {
  if (bookCount <= 0) return [];
  const maxStart = Math.max(0, bookCount - cardsPerView);
  if (maxStart === 0) return [0];
  const starts: number[] = [0];
  let s = 0;
  for (;;) {
    const next = Math.min(maxStart, s + cardsPerView);
    if (next <= s) break;
    starts.push(next);
    s = next;
    if (s >= maxStart) break;
  }
  return starts;
}

function toBookCardBook(book: BookRecentUpdateItem): BookCardBook {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    image: book.image,
    adult_content: book.adult_content,
  };
}

export function HomePage3() {
  const isTablet = useMedia("(max-width: 1024px)");
  const isMobile = useMedia("(max-width: 768px)");
  const isNarrowMobile = useMedia("(max-width: 480px)");

  const batchSize = isMobile ? INITIAL_VISIBLE_MOBILE : INITIAL_VISIBLE_DESKTOP;

  const { data: books = [], isLoading, isError } = useQuery({
    queryKey: ["books-recent-updates-homepage-3"],
    queryFn: getBooksRecentUpdates,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: BOOKS_RECENT_STALE_MS,
  });

  const booksLength = books.length;
  const [visibleCap, setVisibleCap] = useState(batchSize);

  useEffect(() => {
    setVisibleCap(batchSize);
  }, [booksLength, batchSize]);

  const displayedBooks = useMemo(
    () => books.slice(0, Math.min(visibleCap, booksLength)),
    [books, visibleCap, booksLength]
  );

  const cardsPerView = isNarrowMobile ? 1 : isMobile ? 2 : isTablet ? 3 : 4;
  const displayedLength = displayedBooks.length;
  const maxStart = Math.max(0, displayedLength - cardsPerView);

  const [start, setStart] = useState(0);

  const pageStarts = useMemo(
    () => getRecentUpdatePageStarts(displayedLength, cardsPerView),
    [displayedLength, cardsPerView]
  );

  useEffect(() => {
    setStart(0);
  }, [displayedLength, cardsPerView]);

  useEffect(() => {
    if (displayedLength > 0 && start > maxStart) {
      setStart(0);
    }
  }, [displayedLength, maxStart, start]);

  const visibleBooks = useMemo(
    () => displayedBooks.slice(start, start + cardsPerView),
    [displayedBooks, start, cardsPerView]
  );

  const currentPageIndex = Math.max(0, pageStarts.indexOf(start));

  const onPrev = () => {
    if (pageStarts.length <= 1) return;
    const i = pageStarts.indexOf(start);
    const idx = i === -1 ? 0 : i;
    const prevIdx = (idx - 1 + pageStarts.length) % pageStarts.length;
    setStart(pageStarts[prevIdx]!);
  };

  const onNext = () => {
    if (pageStarts.length <= 1) return;
    const i = pageStarts.indexOf(start);
    const idx = i === -1 ? 0 : i;
    const nextIdx = (idx + 1) % pageStarts.length;
    setStart(pageStarts[nextIdx]!);
  };

  const onGoToPage = (pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < pageStarts.length) {
      setStart(pageStarts[pageIndex]!);
    }
  };

  const shownCount = Math.min(visibleCap, booksLength);

  if (isLoading) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Завантаження оновлень…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">
          Не вдалося завантажити оновлення. Спробуйте пізніше.
        </p>
      </section>
    );
  }

  if (booksLength === 0) {
    return (
      <section className="mg2-section" aria-label="Останні оновлення">
        <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Нещодавніх оновлень глав поки немає</p>
      </section>
    );
  }

  return (
    <section className="mg2-section" aria-label="Останні оновлення">
      <SectionLineTitle text="ОСТАННІ ОНОВЛЕННЯ" className="mg2-sectionLineTitle" />

      <div className="mg2-grid">
        {visibleBooks.map((book) => {
          const coverUrl = getBookNewsCoverUrl(book);
          const bookCardBook = toBookCardBook(book);
          const caption = getRecentUpdateCardCaption(book);

          return (
            <article key={book.id} className="mg2-cardShell">
              <BookCard
                book={{
                  ...bookCardBook,
                  image: coverUrl,
                }}
              />
              <p className="mg2-description">{caption}</p>
              <ActionButton
                to={book.slug ? `/books/${book.slug}` : "#"}
                variant="default"
                size="sm"
                className="mg2-readBtn"
                ariaLabel={`Читати: ${book.title}`}
              >
                Читати
              </ActionButton>
            </article>
          );
        })}
      </div>

      <div className="mg2-nav">
        {pageStarts.length > 1 && (
          <>
            <button
              type="button"
              className="mg2-arrowBtn"
              aria-label="Попередня сторінка"
              onClick={onPrev}
            >
              <img src={leftArrow} alt="" className="mg2-arrowIcon" />
            </button>

            <div className="mg2-mobileStars mg2-navStars" aria-label="Сторінки каруселі">
              {pageStarts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mg2-mobileStarDot ${i === currentPageIndex ? "mg2-mobileStarDotActive" : ""}`}
                  onClick={() => onGoToPage(i)}
                  aria-label={`Сторінка ${i + 1} з ${pageStarts.length}`}
                >
                  <img src={starIcon} alt="" />
                </button>
              ))}
            </div>

            <button
              type="button"
              className="mg2-arrowBtn"
              aria-label="Наступна сторінка"
              onClick={onNext}
            >
              <img
                src={leftArrow}
                alt=""
                className="mg2-arrowIcon"
                style={{ transform: "scaleX(-1)" }}
              />
            </button>
          </>
        )}
      </div>

      <ShowMoreNavigation
        className="mg2-showMoreNav"
        visibleCount={shownCount}
        totalCount={booksLength}
        onShowMore={() =>
          setVisibleCap((prev) => Math.min(prev + batchSize, booksLength))
        }
        ariaLabel="Показати ще оновлення"
      />
    </section>
  );
}

export default HomePage3;
