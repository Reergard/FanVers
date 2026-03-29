import { Link } from "react-router-dom";
import badge18 from "../assets/backgrounds/18+small.svg";
import newBadge from "../assets/icons/NEW.svg";
import { resolveIsNewBadge } from "../shared/bookNewBadge";
import type { BookNewsItem } from "../api/mainApi";
import "../BookCard/BookCard.css";

function useNewsBadgeFlags(book: BookNewsItem) {
  const showAdultBadge = Boolean(book.adult_content);
  const showAuthorBadge = book.book_type === "AUTHOR";
  const showNewBadge = resolveIsNewBadge(
    book.is_new_badge,
    book.created_at ?? null,
  );
  return { showAdultBadge, showAuthorBadge, showNewBadge };
}

type CoverProps = {
  book: BookNewsItem;
  coverUrl: string;
  /**
   * false — лише зображення обкладинки (ПК: бейджі на шарі `.mg2-desktopSceneBadges` поверх SVG).
   * @default true
   */
  badgesOnCover?: boolean;
};

/**
 * Обкладинка + бейджі NEW / 18+ / A як у BookCard (default), або лише зображення.
 */
export function NewsCarouselCover({
  book,
  coverUrl,
  badgesOnCover = true,
}: CoverProps) {
  const slug = book.slug;
  const title = book.title || "Обкладинка";
  const imageUrl = coverUrl;

  const { showAdultBadge, showAuthorBadge, showNewBadge } =
    useNewsBadgeFlags(book);

  const cover = (
    <div className="bookCard__cover">
      {badgesOnCover && showNewBadge && (
        <span className="bookCard__badge-new-wrap">
          <img
            className="bookCard__badge-new"
            src={newBadge}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
        </span>
      )}
      {badgesOnCover && showAdultBadge && (
        <span className="bookCard__badge-18-wrap">
          <img
            className="bookCard__badge-18"
            src={badge18}
            alt="18+"
            loading="lazy"
            decoding="async"
          />
        </span>
      )}
      {badgesOnCover && showAuthorBadge && (
        <div className="bookCard__corner-a" aria-hidden="true">
          A
        </div>
      )}
      <img
        className="bookCard__cover-img"
        src={imageUrl}
        alt={title}
        loading="lazy"
        decoding="async"
      />
    </div>
  );

  const inner = (
    <article className="bookCard bookCard--newsCarouselCover">
      {cover}
    </article>
  );

  if (slug) {
    return (
      <Link
        to={`/books/${slug}`}
        className="bookCard-link"
        aria-label={`Читати: ${book.title || "книгу"}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="bookCard-no-link" title="Посилання недоступне">
      {inner}
    </div>
  );
}

/** Бейджі поверх NewBook.svg (нижня частина сцени), лише для ПК-банера новинок */
export function NewsCarouselSceneBadges({ book }: { book: BookNewsItem }) {
  const { showAdultBadge, showAuthorBadge, showNewBadge } =
    useNewsBadgeFlags(book);

  if (!showNewBadge && !showAdultBadge && !showAuthorBadge) {
    return null;
  }

  return (
    <div className="mg2-desktopSceneBadgesInner">
      {showNewBadge && (
        <span className="bookCard__badge-new-wrap">
          <img
            className="bookCard__badge-new"
            src={newBadge}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
        </span>
      )}
      {showAuthorBadge && (
        <div className="bookCard__corner-a" aria-hidden="true">
          A
        </div>
      )}
      {showAdultBadge && (
        <span className="bookCard__badge-18-wrap">
          <img
            className="bookCard__badge-18"
            src={badge18}
            alt="18+"
            loading="lazy"
            decoding="async"
          />
        </span>
      )}
    </div>
  );
}
