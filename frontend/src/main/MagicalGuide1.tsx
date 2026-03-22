import { useEffect, useMemo, useState } from "react";
import { BookCard } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import { useTrendBooks } from "../shared/hooks/useTrendBooks";
import { getTrendCardCaptionFromBook } from "../api/trends/trendCardCaption";

import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";

export function MagicalGuide1() {
  const isTablet = useMedia("(max-width: 1024px)");
  const isMobile = useMedia("(max-width: 768px)");
  const isNarrowMobile = useMedia("(max-width: 480px)");

  const { data: books = [], isPending, isError, isSuccess, isFetching } = useTrendBooks();

  const booksLength = books.length;

  const cardsPerView = isNarrowMobile ? 1 : isMobile ? 2 : isTablet ? 3 : 4;
  const pageCount = booksLength > 0 ? Math.ceil(booksLength / cardsPerView) : 0;

  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (pageCount > 0 && currentPage >= pageCount) {
      setCurrentPage(0);
    }
  }, [pageCount, currentPage]);

  const start = currentPage * cardsPerView;
  const visibleBooks = useMemo(
    () => books.slice(start, start + cardsPerView),
    [books, start, cardsPerView]
  );

  const handleNext = () => {
    if (pageCount <= 1) return;
    setCurrentPage((p) => (p + 1) % pageCount);
  };

  const handlePrev = () => {
    if (pageCount <= 1) return;
    setCurrentPage((p) => (p - 1 + pageCount) % pageCount);
  };

  const handleGoToPage = (page: number) => {
    if (page >= 0 && page < pageCount) setCurrentPage(page);
  };

  const showInitialLoading = isPending && books.length === 0;
  const showRefetchingHint = isFetching && books.length > 0;

  return (
    <section className="mg2-section" aria-label="Тренди">
      <SectionLineTitle text="ТРЕНДИ" className="mg2-sectionLineTitle" />

      {showRefetchingHint && (
        <p className="mg2-topRefetchHint" aria-live="polite">
          Оновлення…
        </p>
      )}

      {showInitialLoading && (
        <p className="mg2-description" aria-live="polite">
          Завантаження списку…
        </p>
      )}

      {isError && (
        <p className="mg2-description" role="alert">
          Не вдалося завантажити тренди. Спробуйте оновити сторінку пізніше.
        </p>
      )}

      {isSuccess && !showInitialLoading && !isFetching && booksLength === 0 && (
        <p className="mg2-description">Поки немає книг у трендах за останні дні.</p>
      )}

      {isSuccess && !showInitialLoading && booksLength > 0 && (
        <>
          <div className="mg2-grid">
            {visibleBooks.map((book) => {
              const caption = getTrendCardCaptionFromBook(book);
              return (
                <article key={book.id} className="mg2-cardShell">
                  <BookCard book={book} />
                  {caption ? (
                    <p className="mg2-description">{caption}</p>
                  ) : (
                    <p className="mg2-description" aria-hidden="true">
                      &nbsp;
                    </p>
                  )}
                  <ActionButton
                    to={book.slug ? `/books/${book.slug}` : undefined}
                    disabled={!book.slug}
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
            {pageCount > 1 && (
              <>
                <button
                  type="button"
                  className="mg2-arrowBtn"
                  aria-label="Попередня сторінка"
                  onClick={handlePrev}
                >
                  <img src={leftArrow} alt="" className="mg2-arrowIcon" />
                </button>

                <div
                  className="mg2-mobileStars mg2-navStars"
                  aria-label="Сторінки каруселі"
                >
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`mg2-mobileStarDot ${i === currentPage ? "mg2-mobileStarDotActive" : ""}`}
                      onClick={() => handleGoToPage(i)}
                      aria-label={`Сторінка ${i + 1} з ${pageCount}`}
                    >
                      <img src={starIcon} alt="" />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="mg2-arrowBtn"
                  aria-label="Наступна сторінка"
                  onClick={handleNext}
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
        </>
      )}
    </section>
  );
}

export default MagicalGuide1;
