import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import {
  catalogKeys,
  getAbandonedTranslations,
  type AbandonedTranslationBook,
  type BookMetaItem,
} from "../api/catalogApi";
import { BookCard } from "../BookCard/BookCard";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SortByNavigation } from "../navigation/SortByNavigation.tsx";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Icon } from "../shared/Icon";
import "./AbandonedTranslations.css";

const PAGE_SIZE = 1;
type SortKey = "choose" | "created" | "updated" | "views" | "income";
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "choose", label: "Вибрати" },
  { value: "created", label: "Датою створення" },
  { value: "updated", label: "Останньою активністю" },
  { value: "views", label: "Переглядами за день" },
  { value: "income", label: "Доходом за місяць" },
];

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function getTagNames(items: BookMetaItem[] | undefined): string[] {
  if (!items?.length) return [];
  return items.map((item) => `#${item.name}`);
}

export default function AbandonedTranslations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("choose");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [checkValues, setCheckValues] = useState<Record<string, boolean>>({
    age18: false,
    noFandoms: false,
    ready100: false,
    viewedOnly: false,
    hideBookmarks: false,
    originalOnly: false,
  });

  const toggleCheck = (key: string) => {
    setCheckValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const abandonedQuery = useQuery({
    queryKey: catalogKeys.abandonedTranslations(),
    queryFn: getAbandonedTranslations,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const books = abandonedQuery.data ?? [];

  const filteredBooks = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    const filtered = books.filter((book) => {
      if (checkValues.age18 && !book.adult_content) return false;
      if (checkValues.noFandoms && (book.fandoms?.length ?? 0) > 0) return false;
      if (
        checkValues.ready100 &&
        book.original_status_display !== "Завершено" &&
        book.original_status_display !== "Завершений"
      ) {
        return false;
      }
      if (checkValues.originalOnly && book.book_type !== "AUTHOR") return false;
      // no reliable fields yet for these toggles in this endpoint
      if (!search) return true;
      return book.title.toLowerCase().includes(search);
    });

    const sorted = [...filtered];
    if (sortBy === "created") {
      sorted.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
    } else if (sortBy === "updated") {
      sorted.sort((a, b) => toTimestamp(b.last_updated) - toTimestamp(a.last_updated));
    } else if (sortBy === "views" || sortBy === "income") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "uk-UA"));
    }
    return sorted;
  }, [books, searchQuery, sortBy, checkValues]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, sortBy, checkValues]);

  const shownCount = filteredBooks.length;
  const visibleBooks = filteredBooks.slice(0, visibleCount);

  return (
    <section className="abandoned-page">
      <Container>
        <div className="abandoned-layout">
          <div className="abandoned-main-col">
            <nav className="abandoned-breadcrumb" aria-label="breadcrumb">
              <Link className="abandoned-breadcrumb-item abandoned-breadcrumb-link" to="/">
                Головна
              </Link>
              <span className="abandoned-breadcrumb-sep">›</span>
              <span className="abandoned-breadcrumb-item abandoned-breadcrumb-item--active">
                Покинуті переклади
              </span>
            </nav>

            <h1 className="abandoned-title">Покинуті переклади</h1>

            <p className="abandoned-note">
              *Забрати покинутий переклад можуть користувачі, які зареєстровані на сайті більше 90 днів
            </p>

            <div className="abandoned-search-row">
              <label className="abandoned-search" aria-label="Пошук по покинутих перекладах">
                <input
                  className="abandoned-search-input"
                  type="search"
                  placeholder="Пошук по покинутих перекладах"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="abandoned-search-btn" type="button" aria-label="Пошук">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                    <path
                      d="M10.5 3a7.5 7.5 0 1 0 4.63 13.43l4.22 4.22a1 1 0 0 0 1.42-1.42l-4.22-4.22A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </label>
            </div>

            <div className="abandoned-toolbar">
              <div className="abandoned-shown">Показано {shownCount} робіт</div>

              <div className="abandoned-sort">
                <SortByNavigation
                  value={sortBy}
                  options={SORT_OPTIONS}
                  onChange={(nextValue) => setSortBy(nextValue as SortKey)}
                  ariaLabel="Сортування покинутих перекладів"
                  labelText="Сортувати за"
                />
              </div>
            </div>

            {abandonedQuery.isLoading ? (
              <div className="abandoned-state">Завантаження покинутих перекладів…</div>
            ) : abandonedQuery.isError ? (
              <div className="abandoned-state abandoned-state-error">
                Не вдалося завантажити список покинутих перекладів.
              </div>
            ) : visibleBooks.length === 0 ? (
              <div className="abandoned-state">На даний момент немає покинутих перекладів.</div>
            ) : (
              <>
                <div className="abandoned-grid">
                  {visibleBooks.map((book: AbandonedTranslationBook) => {
                    const fandomTags = getTagNames(book.fandoms).slice(0, 2);
                    const rowTags = getTagNames(book.tags);
                    const genreTags = getTagNames(book.genres);
                    const limitedRowTags = rowTags.slice(0, 2);
                    const limitedGenres = genreTags.slice(0, 2);
                    const statusText = (book.translation_status_display ?? "Покинутий").toUpperCase();

                    return (
                      <div key={book.id} className="abandoned-card-cell">
                        <div className="abandoned-card-surface">
                          <BookCard book={book} />
                          <div className="abandoned-book-extra">
                            <div className="abandoned-book-status">Статус: {statusText}</div>

                            <div className="abandoned-meta-row">
                              <span className="abandoned-meta-label">Фендом:</span>
                              <div className="abandoned-tags">
                                {fandomTags.length > 0 ? (
                                  fandomTags.map((tag) => (
                                    <span key={tag} className="abandoned-tag">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="abandoned-tag abandoned-tag-empty">—</span>
                                )}
                              </div>
                            </div>

                            <div className="abandoned-meta-row">
                              <span className="abandoned-meta-label">Теги:</span>
                              <div className="abandoned-tags">
                                {limitedRowTags.length > 0 ? (
                                  limitedRowTags.map((tag) => (
                                    <span key={tag} className="abandoned-tag">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="abandoned-tag abandoned-tag-empty">—</span>
                                )}
                                {rowTags.length > 2 && <span className="abandoned-tags-more">▼</span>}
                              </div>
                            </div>

                            <div className="abandoned-meta-row">
                              <span className="abandoned-meta-label">Жанри:</span>
                              <div className="abandoned-tags">
                                {limitedGenres.length > 0 ? (
                                  limitedGenres.map((tag) => (
                                    <span key={tag} className="abandoned-tag">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="abandoned-tag abandoned-tag-empty">—</span>
                                )}
                                {genreTags.length > 2 && <span className="abandoned-tags-more">▼</span>}
                              </div>
                            </div>

                            <div className="abandoned-read-wrap">
                              <ActionButton
                                to={book.slug ? `/books/${book.slug}` : undefined}
                                disabled={!book.slug}
                                variant="default"
                                size="sm"
                                className="abandoned-read-btn"
                                ariaLabel={`Читати ${book.title}`}
                              >
                                Читати
                              </ActionButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ShowMoreNavigation
                  visibleCount={visibleCount}
                  totalCount={filteredBooks.length}
                  onShowMore={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  ariaLabel="Показати ще покинуті переклади"
                />
              </>
            )}
          </div>

          <aside className="abandoned-sidebar">
            <div className="filters-panel">
              <h2 className="filters-title">Фільтри</h2>

              <div className="filters-list" role="list">
                <button className="filters-item" type="button" role="listitem">
                  <span>Жанри</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Фендоми</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Теги</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Виключити жанри</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Виключити фендоми</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Виключити теги</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                <button className="filters-item" type="button" role="listitem">
                  <span>Кількість розділів</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </div>
            </div>

            <div className="filters-checks">
              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Обмеження за віком 18+"
                  aria-pressed={checkValues.age18}
                  onClick={() => toggleCheck("age18")}
                >
                  <Icon name={checkValues.age18 ? "content_checkbox_checked" : "content_checkbox"} aria-hidden />
                </button>
                <span>Обмеження за віком 18+</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Без фендомів"
                  aria-pressed={checkValues.noFandoms}
                  onClick={() => toggleCheck("noFandoms")}
                >
                  <Icon name={checkValues.noFandoms ? "content_checkbox_checked" : "content_checkbox"} aria-hidden />
                </button>
                <span>Без фендомів</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Готові на 100%"
                  aria-pressed={checkValues.ready100}
                  onClick={() => toggleCheck("ready100")}
                >
                  <Icon name={checkValues.ready100 ? "content_checkbox_checked" : "content_checkbox"} aria-hidden />
                </button>
                <span>Готові на 100%</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Тільки переглянуті"
                  aria-pressed={checkValues.viewedOnly}
                  onClick={() => toggleCheck("viewedOnly")}
                >
                  <Icon name={checkValues.viewedOnly ? "content_checkbox_checked" : "content_checkbox"} aria-hidden />
                </button>
                <span>Тільки переглянуті</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Не показувати закладки"
                  aria-pressed={checkValues.hideBookmarks}
                  onClick={() => toggleCheck("hideBookmarks")}
                >
                  <Icon
                    name={checkValues.hideBookmarks ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Не показувати закладки</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Тільки оригінал"
                  aria-pressed={checkValues.originalOnly}
                  onClick={() => toggleCheck("originalOnly")}
                >
                  <Icon name={checkValues.originalOnly ? "content_checkbox_checked" : "content_checkbox"} aria-hidden />
                </button>
                <span>Тільки оригінал</span>
              </label>

              <button className="filters-submit" type="button">
                Пошук
              </button>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
}
