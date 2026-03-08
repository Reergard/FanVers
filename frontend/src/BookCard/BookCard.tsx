import { useState } from "react";
import { Link } from "react-router-dom";
import type { Book, UserTranslationBook } from "../api/catalogApi";
import badge18 from "../assets/backgrounds/18+small.svg";
import newBadge from "../assets/icons/NEW.svg";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Modal } from "../shared/Modal/Modal";
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

function getTagNames(items: { name: string }[] | undefined): string[] {
  if (!items?.length) return [];
  return items.map((item) => `#${item.name}`);
}

type Props = {
  book: Book | UserTranslationBook;
  /** default: дати (Catalog, UserTranslations). withTags: фендоми, теги, жанри, статус, кнопка (Abandoned, Search) */
  variant?: "default" | "withTags";
};

type ExpandModal = "fandoms" | "tags" | "genres" | null;

export function BookCard({ book, variant = "default" }: Props) {
  const slug = book.slug;
  const imageUrl = resolveBookCoverUrl(book.image);
  const withTags = variant === "withTags";
  const [expandModal, setExpandModal] = useState<ExpandModal>(null);

  const userBook = book as UserTranslationBook;
  const allFandoms = getTagNames(book.fandoms);
  const allTags = getTagNames(book.tags);
  const allGenres = getTagNames(book.genres);
  const fandomTags = allFandoms.slice(0, 2);
  const limitedRowTags = allTags.slice(0, 2);
  const limitedGenres = allGenres.slice(0, 2);
  const hasMoreFandoms = allFandoms.length > 2;
  const hasMoreTags = allTags.length > 2;
  const hasMoreGenres = allGenres.length > 2;
  const statusText = (book.translation_status_display ?? "Без статусу").toUpperCase();

  const openExpand = (type: ExpandModal) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandModal(type);
  };

  const cardContent = (
    <article
      className={`bookCard ${withTags ? "bookCard--withTags" : ""}`}
      data-variant={variant}
    >
      <div className="bookCard__cover">
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
        <img
          className="bookCard__cover-img"
          src={imageUrl}
          alt={book.title || "Обкладинка"}
          loading="lazy"
          decoding="async"
        />
        {book.adult_content && (
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
        <div className="bookCard__corner-a" aria-hidden="true">
          A
        </div>
      </div>

      <div className="bookCard__content">
        {withTags ? (
          <div className="bookCard__title-wrap">
            <span className="bookCard__title-inner">
              <h3 className="bookCard__title">{book.title || "Без назви"}</h3>
            </span>
          </div>
        ) : (
          <h3 className="bookCard__title">{book.title || "Без назви"}</h3>
        )}

        <div className="bookCard__meta">
          {withTags ? (
            <>
              <div className="bookCard__row">
                <span className="bookCard__label">Фендоми:</span>
                <div className="bookCard__tags">
                  <span className="bookCard__tags-inner">
                    {fandomTags.length > 0 ? (
                      fandomTags.map((tag) => (
                        <span key={tag} className="bookCard__tag">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="bookCard__tag bookCard__tag--empty">—</span>
                    )}
                  </span>
                  {hasMoreFandoms && (
                    <button
                      type="button"
                      className="bookCard__tags-more"
                      onClick={openExpand("fandoms")}
                      aria-label="Показати всі фендоми"
                    >
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                        <path d="M6.80735 8.60284C6.4087 9.16385 5.57568 9.16385 5.17703 8.60284L0.186168 1.57924C-0.28432 0.917127 0.189075 0 1.00132 0H10.9831C11.7953 0 12.2687 0.917127 11.7982 1.57924L6.80735 8.60284Z" fill="#05B4C7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Теги:</span>
                <div className="bookCard__tags">
                  <span className="bookCard__tags-inner">
                    {limitedRowTags.length > 0 ? (
                      limitedRowTags.map((tag) => (
                        <span key={tag} className="bookCard__tag">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="bookCard__tag bookCard__tag--empty">—</span>
                    )}
                  </span>
                  {hasMoreTags && (
                    <button
                      type="button"
                      className="bookCard__tags-more"
                      onClick={openExpand("tags")}
                      aria-label="Показати всі теги"
                    >
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                        <path d="M6.80735 8.60284C6.4087 9.16385 5.57568 9.16385 5.17703 8.60284L0.186168 1.57924C-0.28432 0.917127 0.189075 0 1.00132 0H10.9831C11.7953 0 12.2687 0.917127 11.7982 1.57924L6.80735 8.60284Z" fill="#05B4C7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Жанри:</span>
                <div className="bookCard__tags">
                  <span className="bookCard__tags-inner">
                    {limitedGenres.length > 0 ? (
                      limitedGenres.map((tag) => (
                        <span key={tag} className="bookCard__tag">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="bookCard__tag bookCard__tag--empty">—</span>
                    )}
                  </span>
                  {hasMoreGenres && (
                    <button
                      type="button"
                      className="bookCard__tags-more"
                      onClick={openExpand("genres")}
                      aria-label="Показати всі жанри"
                    >
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                        <path d="M6.80735 8.60284C6.4087 9.16385 5.57568 9.16385 5.17703 8.60284L0.186168 1.57924C-0.28432 0.917127 0.189075 0 1.00132 0H10.9831C11.7953 0 12.2687 0.917127 11.7982 1.57924L6.80735 8.60284Z" fill="#05B4C7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bookCard__row">
                <span className="bookCard__label">Дата створення</span>
                <span className="bookCard__value">{formatDateOnly(userBook.created_at)}</span>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Дата останньої активності</span>
                <span className="bookCard__value">{formatDateOnly(userBook.last_updated)}</span>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Переглядів за день</span>
                <span className="bookCard__value">{formatStat(userBook.daily_views)}</span>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Дохід за день</span>
                <span className="bookCard__value">{formatStat(userBook.daily_income)}</span>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Дохід за місяць</span>
                <span className="bookCard__value">{formatStat(userBook.monthly_income)}</span>
              </div>
            </>
          )}
        </div>

        {withTags && (
          <div className="bookCard__footer">
            <span className="bookCard__status">Статус: {statusText}</span>
            <ActionButton
              to={slug ? `/books/${slug}` : undefined}
              disabled={!slug}
              variant="default"
              size="sm"
              className="bookCard__btn"
              ariaLabel={`Читати ${book.title}`}
            >
              Читати
            </ActionButton>
          </div>
        )}
      </div>
    </article>
  );

  const modalTitle =
    expandModal === "fandoms"
      ? "Фендоми"
      : expandModal === "tags"
        ? "Теги"
        : expandModal === "genres"
          ? "Жанри"
          : "";

  const modalItems =
    expandModal === "fandoms"
      ? allFandoms
      : expandModal === "tags"
        ? allTags
        : expandModal === "genres"
          ? allGenres
          : [];

  const cardWrapper = slug ? (
    <Link to={`/books/${slug}`} className="bookCard-link">
      {cardContent}
    </Link>
  ) : (
    <div className="bookCard-no-link" title="Посилання недоступне">
      {cardContent}
    </div>
  );

  return (
    <>
      {cardWrapper}
      {withTags && (
        <Modal
          open={expandModal !== null}
          onClose={() => setExpandModal(null)}
          title={modalTitle}
        >
          <div className="bookCard__modal-tags">
            {modalItems.map((tag) => (
              <span key={tag} className="bookCard__tag">
                {tag}
              </span>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
