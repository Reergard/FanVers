import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { UserTranslationBook } from "../api/catalogApi";
import badge18 from "../assets/backgrounds/18+small.svg";
import badge18Large from "../assets/backgrounds/18+.svg";
import ellipseBg from "../assets/backgrounds/Ellipse_for_book.svg";
import newBadge from "../assets/icons/NEW.svg";
import { resolveBookCoverUrl } from "../shared/bookCover/resolveBookCoverUrl";
import { buildBookCardCoverAlt } from "../seo/bookSeo";
import { resolveIsNewBadge } from "../shared/bookNewBadge";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import actionBtnStyles from "../shared/ActionButton/ActionButton.module.css";
import { Icon } from "../shared/Icon";
import { Modal } from "../shared/Modal/Modal";
import { useMedia } from "../shared/hooks/useMedia";
import "./BookCard.css";

/** Як у каруселі «Новинки» (моб.): обмеження довжини + «...»; різні ліміти по ширині екрана. */
function truncateAdDescription(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars).trimEnd();
  return slice.length > 0 ? `${slice}...` : "…";
}

function formatStat(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

function bookDescriptionPlain(text: string | null | undefined): string {
  if (text == null) return "";
  const stripped = String(text).replace(/<[^>]*>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
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

/** Єдиний контракт полів обкладинки та картки для всіх джерел API */
export type BookCardBase = {
  id: number;
  slug?: string | null;
  title?: string | null;
  image?: string | null;

  adult_content?: boolean;
  book_type?: "AUTHOR" | "TRANSLATION" | string | null;
  is_new_badge?: boolean;

  fandoms?: { name: string }[];
  tags?: { name: string }[];
  genres?: { name: string }[];
  translation_status_display?: string | null;
  /** Код статусу перекладу з API (напр. ABANDONED) */
  translation_status?: string | null;

  created_at?: string | null;
  last_updated?: string | null;
  daily_views?: number | string;
  daily_income?: number | string;
  monthly_income?: number | string;
  /** Короткий опис твору (з API); для картки каталогу за `showBookDescription` */
  description?: string | null;
};

export type BookCardBook = BookCardBase;

type Props = {
  book: BookCardBook;
  /** default: дати (Catalog, UserTranslations). withTags: фендоми, теги, жанри, статус, кнопка (Abandoned, Search). bookmark: Закладки. ad: Реклама (еліпс, опис) */
  variant?: "default" | "withTags" | "bookmark" | "ad";
  /** Для variant=ad: опис книги */
  description?: string;
  /** default: замість рядків статистики показати `book.description` (каталог) */
  showBookDescription?: boolean;
  /** withTags: не рендерити footer з кнопкою «Читати» (кнопка виноситься назовні) */
  hideFooter?: boolean;
};

type ExpandModal = "fandoms" | "tags" | "genres" | null;

function renderCoverOverlays(options: {
  showNewBadge: boolean;
  showAdultBadge: boolean;
  showAuthorBadge: boolean;
  adultBadgeSrc: string;
  adultBadgeWrapClassName?: string;
}) {
  const {
    showNewBadge,
    showAdultBadge,
    showAuthorBadge,
    adultBadgeSrc,
    adultBadgeWrapClassName = "bookCard__badge-18-wrap",
  } = options;

  return (
    <>
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

      {showAdultBadge && (
        <span className={adultBadgeWrapClassName}>
          <img
            className="bookCard__badge-18"
            src={adultBadgeSrc}
            alt="18+"
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
    </>
  );
}

export function BookCard({
  book,
  variant = "default",
  description = "",
  showBookDescription = false,
  hideFooter = false,
}: Props) {
  const navigate = useNavigate();
  const slug = book.slug;
  const imageUrl = resolveBookCoverUrl(book.image);
  const withTags = variant === "withTags";
  const isBookmark = variant === "bookmark";
  const isAd = variant === "ad";
  const [expandModal, setExpandModal] = useState<ExpandModal>(null);

  const adMax480 = useMedia("(max-width: 480px)");
  const adMax768 = useMedia("(max-width: 768px)");
  const adMax1024 = useMedia("(max-width: 1024px)");

  const adDescriptionDisplay = useMemo(() => {
    if (!isAd || !description) return "";
    const maxChars = adMax480 ? 220 : adMax768 ? 300 : adMax1024 ? 400 : 480;
    return truncateAdDescription(description, maxChars);
  }, [isAd, description, adMax480, adMax768, adMax1024]);

  const userBook = book as UserTranslationBook;
  const catalogDescriptionText = bookDescriptionPlain(userBook.description ?? undefined);
  const allFandoms = getTagNames(book.fandoms);
  const allTags = getTagNames(book.tags);
  const allGenres = getTagNames(book.genres);
  const fandomTags = allFandoms.slice(0, 2);
  const limitedRowTags = allTags.slice(0, 2);
  const limitedGenres = allGenres.slice(0, 2);
  const hasMoreFandoms = allFandoms.length > 2;
  const hasMoreTags = allTags.length > 2;
  const hasMoreGenres = allGenres.length > 2;
  const isAbandonedTranslation = book.translation_status === "ABANDONED";
  const abandonedStatusText = (
    book.translation_status_display?.trim() || "Покинутий"
  ).toUpperCase();

  const showAdultBadge = Boolean(book.adult_content);
  const showAuthorBadge = book.book_type === "AUTHOR";
  const showNewBadge = resolveIsNewBadge(
    book.is_new_badge,
    book.created_at ?? null,
  );

  const openExpand = (type: ExpandModal) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandModal(type);
  };

  /* variant=bookmark: Закладки — компактний дизайн з іконкою закладки */
  if (isBookmark) {
    const handleRead = () => {
      if (slug) navigate(`/books/${slug}`);
    };
    return (
      <article
        className="bookCard bookCard--bookmark"
        data-variant="bookmark"
      >
        <div className="bookCard__cover bookCard__cover--bookmark">
          {renderCoverOverlays({
            showNewBadge,
            showAdultBadge,
            showAuthorBadge,
            adultBadgeSrc: badge18Large,
            adultBadgeWrapClassName:
              "bookCard__badge-18-wrap bookCard__badge-18-wrap--bookmark",
          })}
          <img
            className="bookCard__cover-img"
            src={imageUrl}
            alt={buildBookCardCoverAlt(book.title || "")}
            loading="lazy"
            decoding="async"
          />
          <span className="bookCard__bookmark-icon" aria-hidden>
            <Icon name="zakladki" />
          </span>
        </div>
        <h3 className="bookCard__title bookCard__title--bookmark">
          {book.title || "Без назви"}
        </h3>
        {isAbandonedTranslation && (
          <p className="bookCard__status bookCard__status--bookmark">
            Статус: {abandonedStatusText}
          </p>
        )}
        <div className="bookCard__actions">
          <ActionButton
            variant="default"
            onClick={handleRead}
            ariaLabel={`Читати: ${book.title}`}
          >
            читати
          </ActionButton>
        </div>
      </article>
    );
  }

  /* variant=ad: реклама на головній — еліпс, опис, vertical line на обкладинці */
  if (isAd) {
    const adArticle = (
      <article
        className="bookCard bookCard--ad"
        data-variant="ad"
        style={{ "--ellipse-bg": `url(${ellipseBg})` } as React.CSSProperties}
      >
        <div className="bookCard__cover bookCard__cover--ad">
          {renderCoverOverlays({
            showNewBadge,
            showAdultBadge,
            showAuthorBadge,
            adultBadgeSrc: badge18Large,
          })}
          <img
            className="bookCard__cover-img"
            src={imageUrl}
            alt={buildBookCardCoverAlt(book.title || "")}
            loading="lazy"
            decoding="async"
          />
        </div>
        <h3 className="bookCard__title bookCard__title--ad">
          {book.title || "Без назви"}
        </h3>
        {adDescriptionDisplay && (
          <p className="bookCard__desc">{adDescriptionDisplay}</p>
        )}
        <div className="bookCard__actions">
          <span
            className={`${actionBtnStyles.btn} ${actionBtnStyles.variant_default} bookCard__ad-read`}
            aria-hidden="true"
          >
            читати
          </span>
        </div>
      </article>
    );

    return slug ? (
      <Link
        to={`/books/${slug}`}
        className="bookCard-link"
        aria-label={`Читати: ${book.title || "книгу"}`}
      >
        {adArticle}
      </Link>
    ) : (
      adArticle
    );
  }

  const cardContent = (
    <article
      className={`bookCard ${withTags ? "bookCard--withTags" : ""}${
        withTags && !isAbandonedTranslation ? " bookCard--noTranslationStatus" : ""
      }${!withTags && showBookDescription ? " bookCard--catalogWithDescription" : ""}`}
      data-variant={variant}
    >
      <div className="bookCard__cover">
        {renderCoverOverlays({
          showNewBadge,
          showAdultBadge,
          showAuthorBadge,
          adultBadgeSrc: badge18,
        })}
        <img
          className="bookCard__cover-img"
          src={imageUrl}
          alt={buildBookCardCoverAlt(book.title || "")}
          loading="lazy"
          decoding="async"
        />
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
          ) : showBookDescription ? (
            <>
              <p
                className={
                  catalogDescriptionText
                    ? "bookCard__catalogDescription"
                    : "bookCard__catalogDescription bookCard__catalogDescription--empty"
                }
              >
                {catalogDescriptionText || "—"}
              </p>
              {isAbandonedTranslation && (
                <div className="bookCard__defaultAbandonedStatus bookCard__defaultAbandonedStatus--inMeta">
                  <span className="bookCard__status">Статус: {abandonedStatusText}</span>
                </div>
              )}
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
                <span className="bookCard__label">Читачів</span>
                <span className="bookCard__value">{formatStat(userBook.total_readers)}</span>
              </div>
              <div className="bookCard__row">
                <span className="bookCard__label">Дочитали до кінця</span>
                <span className="bookCard__value">{formatStat(userBook.completed_readers)}</span>
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

        {!withTags && isAbandonedTranslation && !showBookDescription && (
          <div className="bookCard__defaultAbandonedStatus">
            <span className="bookCard__status">Статус: {abandonedStatusText}</span>
          </div>
        )}

        {withTags && !hideFooter && (
          <div className="bookCard__footer">
            {isAbandonedTranslation && (
              <span className="bookCard__status">Статус: {abandonedStatusText}</span>
            )}
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
