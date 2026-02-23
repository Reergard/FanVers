import { Link } from "react-router-dom";
import { Container } from "../shared/Container";
import { BookCard } from "../BookCard/BookCard";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation";
import { SortByNavigation } from "../navigation/SortByNavigation";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Icon } from "../shared/Icon";
import type { UserTranslationBook } from "../api/catalogApi";
import "./search.css";

type SearchCard = {
  id: number;
  book: UserTranslationBook;
  statusText: string;
  fandoms: string[];
  tags: string[];
  genres: string[];
};

const SORT_OPTIONS = [
  { value: "choose", label: "Вибрати" },
  { value: "created", label: "Датою створення" },
  { value: "updated", label: "Останньою активністю" },
  { value: "views", label: "Переглядами за день" },
  { value: "income", label: "Доходом за місяць" },
] as const;

const SEARCH_CARDS: SearchCard[] = [
  {
    id: 1,
    book: {
      id: 101,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
  {
    id: 2,
    book: {
      id: 102,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
  {
    id: 3,
    book: {
      id: 103,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
  {
    id: 4,
    book: {
      id: 104,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
  {
    id: 5,
    book: {
      id: 105,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
  {
    id: 6,
    book: {
      id: 106,
      slug: "",
      title: "ХАОТИЧНИЙ БОГ МЕЧА",
      owner: 0,
      adult_content: true,
      image: null,
      created_at: null,
      last_updated: null,
      daily_income: 0,
      monthly_income: 0,
      daily_views: 0,
    },
    statusText: "ПОКИНУТО",
    fandoms: ["#гаррі поттер"],
    tags: ["#відріз мітронто", "#мандрівка"],
    genres: ["#містика", "#фентезі"],
  },
];

export default function SearchPage() {
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
              <span className="abandoned-breadcrumb-item abandoned-breadcrumb-item--active">Пошук</span>
            </nav>

            <h1 className="abandoned-title">Пошук</h1>

            <p className="abandoned-note">*Результати пошуку за заданими параметрами</p>

            <div className="abandoned-search-row">
              <label className="abandoned-search" aria-label="Пошук">
                <input
                  className="abandoned-search-input"
                  type="search"
                  placeholder="Пошук"
                  autoComplete="off"
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
              <div className="abandoned-shown">Показано {SEARCH_CARDS.length} робіт</div>

              <div className="abandoned-sort">
                <SortByNavigation
                  value="choose"
                  options={[...SORT_OPTIONS]}
                  onChange={() => {}}
                  ariaLabel="Сортування результатів пошуку"
                  labelText="Сортувати за"
                />
              </div>
            </div>

            <div className="abandoned-grid">
              {SEARCH_CARDS.map((card) => {
                const fandomTags = card.fandoms.slice(0, 2);
                const limitedRowTags = card.tags.slice(0, 2);
                const limitedGenres = card.genres.slice(0, 2);

                return (
                  <div key={card.id} className="abandoned-card-cell">
                    <div className="abandoned-card-surface">
                      <BookCard book={card.book} />
                      <div className="abandoned-book-extra">
                        <div className="abandoned-book-status">Статус: {card.statusText}</div>

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
                            {card.tags.length > 2 && <span className="abandoned-tags-more">▼</span>}
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
                            {card.genres.length > 2 && <span className="abandoned-tags-more">▼</span>}
                          </div>
                        </div>

                        <div className="abandoned-read-wrap">
                          <ActionButton
                            to={card.book.slug ? `/books/${card.book.slug}` : undefined}
                            disabled={!card.book.slug}
                            variant="default"
                            size="sm"
                            className="abandoned-read-btn"
                            ariaLabel={`Читати ${card.book.title}`}
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
              visibleCount={SEARCH_CARDS.length}
              totalCount={SEARCH_CARDS.length * 2}
              onShowMore={() => {}}
              ariaLabel="Показати ще результати пошуку"
            />
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
                <button className="filters-checkbox-btn" type="button" aria-label="Обмеження за віком 18+" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
                </button>
                <span>Обмеження за віком 18+</span>
              </label>

              <label className="filters-check">
                <button className="filters-checkbox-btn" type="button" aria-label="Без фендомів" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
                </button>
                <span>Без фендомів</span>
              </label>

              <label className="filters-check">
                <button className="filters-checkbox-btn" type="button" aria-label="Готові на 100%" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
                </button>
                <span>Готові на 100%</span>
              </label>

              <label className="filters-check">
                <button className="filters-checkbox-btn" type="button" aria-label="Тільки переглянуті" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
                </button>
                <span>Тільки переглянуті</span>
              </label>

              <label className="filters-check">
                <button className="filters-checkbox-btn" type="button" aria-label="Не показувати закладки" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
                </button>
                <span>Не показувати закладки</span>
              </label>

              <label className="filters-check">
                <button className="filters-checkbox-btn" type="button" aria-label="Тільки оригінал" aria-pressed="false">
                  <Icon name="content_checkbox" aria-hidden />
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
