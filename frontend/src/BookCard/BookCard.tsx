import { Link } from "react-router-dom";
import type { UserTranslationBook } from "../api/catalogApi";
import badge18 from "../assets/backgrounds/18+.svg";
import coverPlaceholder from "../assets/1SR-gLCHT4s.jpg";
import "./BookCard.css";

function getImageUrl(book: UserTranslationBook): string {
  const img = book.image;
  if (!img) return "";
  if (img.startsWith("http")) return img;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}${img}` : img;
}

function formatStat(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

type Props = {
  book: UserTranslationBook;
};

export function BookCard({ book }: Props) {
  const slug = book.slug;
  const imageUrl = getImageUrl(book) || coverPlaceholder;

  const cardContent = (
    <article className="book-card">
      <div className="book-card-cover-wrap">
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
          <span className="book-card-meta-value">{book.created_at ?? "—"}</span>
        </div>
        <div className="book-card-meta-row">
          <span className="book-card-meta-label">Дата останньої активності</span>
          <span className="book-card-meta-value">{book.last_updated ?? "—"}</span>
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
