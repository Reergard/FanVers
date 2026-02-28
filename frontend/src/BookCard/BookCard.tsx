import { Link } from "react-router-dom";
import type { UserTranslationBook } from "../api/catalogApi";
import badge18 from "../assets/backgrounds/18+.svg";
import newBadge from "../assets/icons/NEW.svg";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import "./BookCard.css";

function formatStat(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [day, month, year] = value.split(".");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

type Props = {
  book: UserTranslationBook;
};

export function BookCard({ book }: Props) {
  const slug = book.slug;
  const imageUrl = resolveBookCoverUrl(book.image);

  const cardContent = (
    <article className="book-card">
      <div className="book-card-cover-wrap">
        <img
          className="book-card-badge-new"
          src={newBadge}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
        <img
          className="book-card-cover"
          src={imageUrl}
          alt={book.title || "Обкладинка"}
          loading="lazy"
          decoding="async"
        />
        {book.adult_content && (
          <img
            className="book-card-badge-18"
            src={badge18}
            alt="18+"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="book-card-corner-a" aria-hidden="true">
          A
        </div>
      </div>
      <h3 className="book-card-title">{book.title || "Без назви"}</h3>
      <div className="book-card-meta-block">
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Дата створення</span>
          <span className="book-card-meta-value">{formatDateOnly(book.created_at)}</span>
        </div>
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Дата останньої активності</span>
          <span className="book-card-meta-value">{formatDateOnly(book.last_updated)}</span>
        </div>
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Переглядів за день</span>
          <span className="book-card-meta-value">{formatStat(book.daily_views)}</span>
        </div>
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Дохід за день</span>
          <span className="book-card-meta-value">{formatStat(book.daily_income)}</span>
        </div>
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Дохід за місяць</span>
          <span className="book-card-meta-value">{formatStat(book.monthly_income)}</span>
        </div>
      </div>
    </article>
  );

  if (slug) {
    return (
      <Link to={`/books/${slug}`} className="book-card-link">
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="book-card-no-link" title="Посилання недоступне">
      {cardContent}
    </div>
  );
}
