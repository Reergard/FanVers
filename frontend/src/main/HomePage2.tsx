import { useCallback, useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionLineTitle } from "../navigation/SectionLineTitle";
import {
  NewsCarouselCover,
  NewsCarouselSceneBadges,
} from "./NewsCarouselCover";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useMedia } from "../shared/hooks/useMedia";
import { fetchBookRatings } from "../api/ratingApi";
import { getBooksNews, getBookNewsCoverUrl, type BookNewsItem } from "../api/mainApi";
import bookDetailStyles from "../catalog/styles/BookDetail.module.css";
import "./HomePage.module.css";

import newsFrame from "./assets/backgrounds/news_section.svg";
import newBookBg from "./assets/backgrounds/NewBook.svg";
import bookDecorRaw from "./assets/backgrounds/book.svg?raw";
import starIcon from "../assets/backgrounds/star_navigation_books.svg";
import leftArrow from "../assets/backgrounds/left_arrow.svg";
import rightArrow from "../assets/backgrounds/right_arrow.svg";

const BOOKS_NEWS_STALE_MS = 5 * 60 * 1000;
const AUTOPLAY_INTERVAL_MS = 9000;
/** Скорочений опис у моб. і ПК — однакова логіка відображення тексту */
const NEWS_DESCRIPTION_MAX_CHARS = 500;

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
  const translationAverage =
    slugForRatings && ratingsData?.translation_rating
      ? ratingsData.translation_rating.average
      : 0;

  const description = book.description ?? "";
  const shortDescription =
    description.length > NEWS_DESCRIPTION_MAX_CHARS
      ? `${description.slice(0, NEWS_DESCRIPTION_MAX_CHARS)}...`
      : description;

  const coverUrl = getBookNewsCoverUrl(book);

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
            <div
              className="mg2-mobileMediaCol"
              {...(book.is_new_badge ? { "data-new": "" } : {})}
            >
              <div className="mg2-mobileBookCardWrap">
                <NewsCarouselCover book={book} coverUrl={coverUrl} />
              </div>
            </div>

            <div className="mg2-mobileInfoCol">
              <div className="mg2-mobileRatingBlock">
                <p className="mg2-mobileRatingLabel">РЕЙТИНГ ТВОРУ</p>
                <RatingStarsDisplay average={workAverage} label="Рейтинг твору" />
              </div>

              {book.book_type !== "AUTHOR" ? (
                <div className="mg2-mobileRatingBlock">
                  <p className="mg2-mobileRatingLabel">ЯКІСТЬ ПЕРЕКЛАДУ</p>
                  <RatingStarsDisplay average={translationAverage} label="Якість перекладу" />
                </div>
              ) : null}

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

function DesktopNewsBanner({
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
  const workAverage =
    slugForRatings && ratingsData ? ratingsData.book_rating.average : 0;
  const translationAverage =
    slugForRatings && ratingsData?.translation_rating
      ? ratingsData.translation_rating.average
      : 0;

  const description = book.description ?? "";
  const shortDescription =
    description.length > NEWS_DESCRIPTION_MAX_CHARS
      ? `${description.slice(0, NEWS_DESCRIPTION_MAX_CHARS)}...`
      : description;

  const coverUrl = getBookNewsCoverUrl(book);

  const titleId = useId();

  return (
    <article className="mg2-desktopBanner" aria-labelledby={titleId}>
      <button
        type="button"
        className="mg2-desktopArrow mg2-desktopArrowLeft"
        aria-label="Попередня книга"
        onClick={onPrev}
      >
        <img src={leftArrow} alt="" />
      </button>

      <div className="mg2-desktopBannerInner">
        <div className="mg2-desktopMedia">
          <div className="mg2-desktopSceneStage">
            <div className="mg2-desktopCoverWrap">
              <div className="mg2-desktopCoverBookWrap">
                <NewsCarouselCover
                  book={book}
                  coverUrl={coverUrl}
                  badgesOnCover={false}
                />
              </div>
            </div>

            <img
              src={newBookBg}
              alt=""
              aria-hidden="true"
              className="mg2-desktopScene"
              width={1042}
              height={698}
            />

            <div className="mg2-desktopSceneBadges" aria-hidden="true">
              <NewsCarouselSceneBadges book={book} />
            </div>

            <div className="mg2-desktopWorkRating">
              <p className="mg2-desktopRatingLabel">РЕЙТИНГ ТВОРУ</p>
              <RatingStarsDisplay average={workAverage} label="Рейтинг твору" />
            </div>

            {book.book_type !== "AUTHOR" ? (
              <div className="mg2-desktopTranslationRating">
                <p className="mg2-desktopRatingLabel">ЯКІСТЬ ПЕРЕКЛАДУ</p>
                <RatingStarsDisplay
                  average={translationAverage}
                  label="Якість перекладу"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mg2-desktopContent">
          <h3 id={titleId} className="mg2-desktopTitle">
            {book.title}
          </h3>
          <p className="mg2-desktopDescription">{shortDescription}</p>

          <ActionButton
            to={book.slug ? `/books/${book.slug}` : "#"}
            variant="primary"
            size="sm"
            className="mg2-desktopReadBtn"
            ariaLabel={`Читати: ${book.title}`}
          >
            Читати
          </ActionButton>
        </div>
      </div>

      <button
        type="button"
        className="mg2-desktopArrow mg2-desktopArrowRight"
        aria-label="Наступна книга"
        onClick={onNext}
      >
        <img src={rightArrow} alt="" />
      </button>

      <div className="mg2-desktopDots" aria-label="Сторінки каруселі">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`mg2-desktopDot ${
              i === currentBookIndex ? "mg2-desktopDotActive" : ""
            }`}
            onClick={() => onGoTo(i)}
            aria-label={`Книга ${i + 1} з ${total}`}
          >
            <img src={starIcon} alt="" />
          </button>
        ))}
      </div>
    </article>
  );
}

export function HomePage2() {
  const isMobile = useMedia("(max-width: 768px)");

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

  const handleNext = useCallback(() => {
    setCurrentBookIndex((prev) => {
      if (booksLength <= 0) return prev;
      return (prev + 1) % booksLength;
    });
  }, [booksLength]);

  const handlePrev = useCallback(() => {
    setCurrentBookIndex((prev) => {
      if (booksLength <= 0) return prev;
      return (prev - 1 + booksLength) % booksLength;
    });
  }, [booksLength]);

  const handleGoTo = useCallback((index: number) => {
    setCurrentBookIndex((prev) => {
      if (index >= 0 && index < booksLength) return index;
      return prev;
    });
  }, [booksLength]);

  useEffect(() => {
    if (!books || !Array.isArray(books) || booksLength <= 1) return;
    const id = setInterval(handleNext, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [books, booksLength, handleNext]);

  useEffect(() => {
    if (booksLength > 0 && currentBookIndex >= booksLength) {
      setCurrentBookIndex(0);
    }
  }, [booksLength, currentBookIndex]);

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
    <section className="mg2-section mg2-desktopNewsSection" aria-label="Новинки">
      <SectionLineTitle text="НОВИНКИ" className="mg2-sectionLineTitle" />

      <DesktopNewsBanner
        book={currentBook!}
        onPrev={handlePrev}
        onNext={handleNext}
        onGoTo={handleGoTo}
        currentBookIndex={currentBookIndex}
        total={booksLength}
      />
    </section>
  );
}

export default HomePage2;
