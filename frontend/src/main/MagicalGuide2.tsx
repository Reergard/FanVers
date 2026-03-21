import { useEffect, useMemo, useState } from "react";
import { BookCard } from "../BookCard/BookCard";
import type { BookCardBook } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";

import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";

const STUB_DESCRIPTION =
  "Незабаром тут з’явиться підбірка. Логіку рекомендацій підключимо пізніше.";

/** Заглушки; пізніше замінити на дані з власного API/запиту для РЕКОМЕНДАЦІЙ. */
function getRecommendationStubBooks(): BookCardBook[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: 12_000 + i,
    slug: "",
    title: `Рекомендація · ${i + 1}`,
    owner: 0,
    adult_content: false,
    image: null,
  }));
}

export function MagicalGuide2() {
  const isTablet = useMedia("(max-width: 1024px)");
  const isMobile = useMedia("(max-width: 768px)");
  const isNarrowMobile = useMedia("(max-width: 480px)");

  const books = useMemo(() => getRecommendationStubBooks(), []);
  const booksLength = books.length;

  const [currentBookIndex, setCurrentBookIndex] = useState(0);

  const handleNext = () => {
    if (booksLength === 0) return;
    setCurrentBookIndex((prev) => (prev + 1) % booksLength);
  };

  const handlePrev = () => {
    if (booksLength === 0) return;
    setCurrentBookIndex((prev) => (prev - 1 + booksLength) % booksLength);
  };

  const handleGoTo = (index: number) => {
    if (index >= 0 && index < booksLength) {
      setCurrentBookIndex(index);
    }
  };

  useEffect(() => {
    if (booksLength > 0 && currentBookIndex >= booksLength) {
      setCurrentBookIndex(0);
    }
  }, [booksLength, currentBookIndex]);

  const cardsPerView = isNarrowMobile ? 1 : isMobile ? 2 : isTablet ? 3 : 4;
  const maxStart = Math.max(0, booksLength - cardsPerView);
  const start = Math.min(currentBookIndex, maxStart);
  const visibleBooks = useMemo(
    () => books.slice(start, start + cardsPerView),
    [books, start, cardsPerView]
  );

  return (
    <section className="mg2-section" aria-label="Рекомендації">
      <SectionLineTitle text="Рекомендації" className="mg2-sectionLineTitle" />

      <div className="mg2-grid">
        {visibleBooks.map((book) => {
          const coverUrl = resolveBookCoverUrl(book.image);
          return (
            <article key={book.id} className="mg2-cardShell">
              <BookCard book={{ ...book, image: coverUrl }} />
              <p className="mg2-description">{STUB_DESCRIPTION}</p>
              <ActionButton
                to="#"
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
        {booksLength > 1 && (
          <>
            <button
              type="button"
              className="mg2-arrowBtn"
              aria-label="Попередня сторінка"
              onClick={handlePrev}
            >
              <img src={leftArrow} alt="" className="mg2-arrowIcon" />
            </button>

            <div className="mg2-mobileStars mg2-navStars" aria-label="Сторінки каруселі">
              {Array.from({ length: booksLength }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mg2-mobileStarDot ${i === currentBookIndex ? "mg2-mobileStarDotActive" : ""}`}
                  onClick={() => handleGoTo(i)}
                  aria-label={`Книга ${i + 1} з ${booksLength}`}
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
    </section>
  );
}

export default MagicalGuide2;
