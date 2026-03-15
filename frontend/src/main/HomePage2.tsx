import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookCard } from "../BookCard/BookCard";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import type { BookCardBook } from "../BookCard/BookCard";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import { fetchBookRatings } from "../api/ratingApi";
import { getBooksNews, getBookNewsCoverUrl, type BookNewsItem } from "../api/mainApi";
import bookDetailStyles from "../catalog/styles/BookDetail.module.css";
import styles from "./HomePage.module.css";
import "./MagicalGuide.css";

import newsFrame from "./assets/backgrounds/news_section.svg";
import bookDecorRaw from "./assets/backgrounds/book.svg?raw";
import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";
import rightArrow from "../assets/backgrounds/right_arrow.svg";

const BOOKS_NEWS_STALE_MS = 5 * 60 * 1000;
const AUTOPLAY_INTERVAL_MS = 9000;

/** Маппінг BookNewsItem → BookCardBook для BookCard. */
function toBookCardBook(book: BookNewsItem): BookCardBook {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    image: book.image,
    adult_content: book.adult_content,
    owner: 0,
  };
}

/** Ті самі зірки й логіка, що на сторінці книги: ★ з трьома станами (empty/average/filled). */
function RatingStarsDisplay({
  average,
  label,
}: {
  average: number;
  label: string;
}) {
  const roundedAverage = Math.min(5, Math.max(0, Math.round(Number(average)) || 0));
  const getStarState = (starNumber: number): "empty" | "average" | "filled" => {
    if (starNumber < 1 || starNumber > 5) return "empty";
    if (roundedAverage >= starNumber) return "average";
    return "empty";
  };
  const getStarClassName = (starNumber: number): string => {
    const state = getStarState(starNumber);
    return `${bookDetailStyles.ratingStarBtn} ${bookDetailStyles[state === "empty" ? "ratingStarEmpty" : state === "average" ? "ratingStarAverage" : "ratingStarFilled"]}`;
  };

  return (
    <div
      className={bookDetailStyles.ratingStars}
      role="group"
      aria-label={`${label}: ${Number(average) > 0 ? `${Number(average).toFixed(1)} з 5` : "оцінити"}`}
    >
      {[1, 2, 3, 4, 5].map((starNumber) => (
        <span
          key={starNumber}
          className={getStarClassName(starNumber)}
          aria-hidden="true"
          style={{ cursor: "default" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function MobileNewsCard({
  book,
  onPrev,
  onNext,
  onGoTo,
  currentBookIndex,
  total,
}: {
  book: BookNewsItem;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  currentBookIndex: number;
  total: number;
}) {
  const slugForRatings = (book.slug && String(book.slug).trim()) || "";
  const ratingsQuery = useQuery({
    queryKey: ["book-ratings", slugForRatings],
    queryFn: () => fetchBookRatings(slugForRatings),
    enabled: Boolean(slugForRatings),
    staleTime: 60_000,
    retry: 1,
  });

  const ratingsData = ratingsQuery.data;
  const workAverage = slugForRatings && ratingsData
    ? ratingsData.book_rating.average
    : 0;
  const translationAverage = slugForRatings && ratingsData
    ? ratingsData.translation_rating.average
    : 0;

  const description = book.description ?? "";
  const shortDescription =
    description.length > 500 ? `${description.slice(0, 500)}...` : description;

  const coverUrl = getBookNewsCoverUrl(book);
  const bookCardBook = toBookCardBook(book);

  return (
    <section className="mg2-mobileSection" aria-label="Новинки">
      <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />

      <article className="mg2-mobileCard">
        <h3 className="mg2-mobileTitle">{book.title}</h3>

        <div className="mg2-mobileFrameOuter">
        <div className="mg2-mobileFrameWrap">
          <img
            src={newsFrame}
            alt=""
            aria-hidden="true"
            className="mg2-mobileFrame"
          />

          <div className="mg2-mobileFrameContent">
            <div className="mg2-mobileMediaCol">
              <div className="mg2-mobileBookCardWrap">
                <BookCard
                  book={{
                    ...bookCardBook,
                    image: coverUrl,
                  }}
                />
              </div>
            </div>

            <div className="mg2-mobileInfoCol">
              <div className="mg2-mobileRatingBlock">
                <p className="mg2-mobileRatingLabel">РЕЙТИНГ ТВОРУ</p>
                <RatingStarsDisplay average={workAverage} label="Рейтинг твору" />
              </div>

              <div className="mg2-mobileRatingBlock">
                <p className="mg2-mobileRatingLabel">ЯКІСТЬ ПЕРЕКЛАДУ</p>
                <RatingStarsDisplay average={translationAverage} label="Якість перекладу" />
              </div>

              <div className="mg2-mobileBookDecorWrap" aria-hidden="true">
                <div
                  className="mg2-mobileBookDecor"
                  dangerouslySetInnerHTML={{ __html: bookDecorRaw }}
                />
              </div>

              <ActionButton
                to={book.slug ? `/books/${book.slug}` : "#"}
                variant="primary"
                size="sm"
                className="mg2-mobileReadBtn"
                ariaLabel={`Читати: ${book.title}`}
              >
                Читати
              </ActionButton>
            </div>
          </div>
        </div>
        </div>

        <p className="mg2-mobileDescription">{shortDescription}</p>

        <div className="mg2-mobileNav">
          <button
            type="button"
            className="mg2-mobileNavBtn"
            aria-label="Попередня книга"
            onClick={onPrev}
          >
            <img src={leftArrow} alt="" />
          </button>

          <div className="mg2-mobileStars" aria-label="Сторінки каруселі">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`mg2-mobileStarDot ${i === currentBookIndex ? "mg2-mobileStarDotActive" : ""}`}
                onClick={() => onGoTo(i)}
                aria-label={`Книга ${i + 1} з ${total}`}
              >
                <img src={starIcon} alt="" />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="mg2-mobileNavBtn"
            aria-label="Наступна книга"
            onClick={onNext}
          >
            <img src={rightArrow} alt="" />
          </button>
        </div>
      </article>
    </section>
  );
}

export function MagicalGuide1Content() {
  const isTablet = useMedia("(max-width: 1024px)");
  const isMobile = useMedia("(max-width: 768px)");
  const isNarrowMobile = useMedia("(max-width: 480px)");

  const { data: books = [], isLoading, isError } = useQuery({
    queryKey: ["books-news-homepage-2"],
    queryFn: getBooksNews,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: BOOKS_NEWS_STALE_MS,
  });

  const [currentBookIndex, setCurrentBookIndex] = useState(0);

  const currentBook = books?.[currentBookIndex];
  const booksLength = books?.length ?? 0;

  const handleNext = () => {
    if (!books || !Array.isArray(books) || booksLength === 0) return;
    setCurrentBookIndex((prev) => (prev + 1) % booksLength);
  };

  const handlePrev = () => {
    if (!books || !Array.isArray(books) || booksLength === 0) return;
    setCurrentBookIndex((prev) => (prev - 1 + booksLength) % booksLength);
  };

  const handleGoTo = (index: number) => {
    if (index >= 0 && index < booksLength) {
      setCurrentBookIndex(index);
    }
  };

  useEffect(() => {
    if (!books || !Array.isArray(books) || booksLength <= 1) return;
    const id = setInterval(handleNext, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [books, booksLength]);

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

  if (isLoading) {
    return (
      <section className="mg2-mobileSection" aria-label="Новинки">
        <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Завантаження новинок...</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mg2-mobileSection" aria-label="Новинки">
        <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">
          Не вдалося завантажити новинки. Спробуйте пізніше.
        </p>
      </section>
    );
  }

  if (!books || !Array.isArray(books) || booksLength === 0) {
    return (
      <section className="mg2-mobileSection" aria-label="Новинки">
        <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />
        <p className="mg2-placeholder">Новинок поки немає</p>
      </section>
    );
  }

  if (isMobile) {
    return (
      <MobileNewsCard
        book={currentBook!}
        onPrev={handlePrev}
        onNext={handleNext}
        onGoTo={handleGoTo}
        currentBookIndex={currentBookIndex}
        total={booksLength}
      />
    );
  }

  return (
    <section className="mg2-section" aria-label="Новинки">
      <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />

      <div className="mg2-grid">
        {visibleBooks.map((book) => {
          const description = book.description ?? "";
          const shortDescription =
            description.length > 500 ? `${description.slice(0, 500)}...` : description;
          const coverUrl = getBookNewsCoverUrl(book);
          const bookCardBook = toBookCardBook(book);

          return (
            <article key={book.id} className="mg2-cardShell">
              <BookCard
                book={{
                  ...bookCardBook,
                  image: coverUrl,
                }}
              />
              <p className="mg2-description">{shortDescription}</p>
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
              <img src={rightArrow} alt="" className="mg2-arrowIcon" style={{ transform: "scaleX(-1)" }} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export function HomePage2() {
  return (
    <div className={styles.section2}>
      <MagicalGuide1Content />
    </div>
  );
}

export default HomePage2;
