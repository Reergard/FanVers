import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Container } from "../shared/Container";
import { BookCard } from "../BookCard/BookCard";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation";
import { SortByNavigation } from "../navigation/SortByNavigation";
import { FilterDropdown } from "../navigation/FilterDropdown";
import { FiltersSidebar } from "../navigation/FiltersSidebar";
import { PageTitle } from "../navigation/PageTitle";
import { Icon } from "../shared/Icon";
import { Modal } from "../shared/Modal/Modal";
import {
  catalogApi,
  type BookMetaItem,
  type BookCountry,
  type TagWithGroup,
  type UserTranslationBook,
} from "../api/catalogApi";
import { searchBooks, type SearchFilters } from "../api/searchApi";
import { useDebouncedValue } from "../shared/hooks/useDebouncedValue";
import { useAdultContent } from "../settings/useAdultContent";
import { useAuth } from "../auth/useAuth";
import {
  getSearchAds,
  advertisingKeys,
} from "../api/advertisingApi";
import { AdvertisingCarousel } from "../website_advertising/AdvertisingBooks";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { getMyProfile, updateNotificationSettings } from "../users/profileService";
import "./search.css";

const SORT_OPTIONS = [
  { value: "-chapter_count", label: "Кількістю розділів (спадання)" },
  { value: "chapter_count", label: "Кількістю розділів (зростання)" },
  { value: "-created_at", label: "Датою створення" },
  { value: "-last_updated", label: "Останньою активністю" },
] as const;

const PAGE_SIZE = 3;
type MultiFilterKey =
  | "genres"
  | "tags"
  | "fandoms"
  | "countries"
  | "exclude_genres"
  | "exclude_tags"
  | "exclude_fandoms";
type FilterPanel = MultiFilterKey | "chapters" | null;

const FILTER_LABELS: Record<MultiFilterKey, string> = {
  genres: "Жанри",
  tags: "Теги",
  fandoms: "Фендоми",
  countries: "Країни",
  exclude_genres: "Виключити жанри",
  exclude_tags: "Виключити теги",
  exclude_fandoms: "Виключити фендоми",
};

function toggleId(list: number[], id: number) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function parseNumberInput(value: string): number | "" {
  if (!value.trim()) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed;
}

export default function SearchPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(queryFromUrl);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activePanel, setActivePanel] = useState<FilterPanel>(null);
  const [activePanelAnchor, setActivePanelAnchor] = useState<HTMLElement | null>(null);
  const [isForceFetching, setIsForceFetching] = useState(false);
  const [forcedError, setForcedError] = useState<string | null>(null);
  const [forcedData, setForcedData] = useState<UserTranslationBook[] | null>(null);
  const [forcedUpdatedAt, setForcedUpdatedAt] = useState(0);
  const [adultRestrictionConfirmOpen, setAdultRestrictionConfirmOpen] = useState(false);
  const [checkValues, setCheckValues] = useState({
    noFandoms: false,
    ready100: false,
    viewedOnly: false,
    hideBookmarks: false,
    originalOnly: false,
  });
  const { hideAdultContent, setHideAdultContent } = useAdultContent();
  const { isAuthenticated, userId, authReady } = useAuth();
  const { showWarning, showError } = useNotification();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: authReady && isAuthenticated,
    staleTime: 60_000,
  });

  const [filters, setFilters] = useState<SearchFilters>({
    genres: [],
    tags: [],
    fandoms: [],
    countries: [],
    exclude_genres: [],
    exclude_tags: [],
    exclude_fandoms: [],
    min_chapters: "",
    max_chapters: "",
    order: "-chapter_count",
  });

  useEffect(() => {
    setSearchQuery(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (profileQuery.data?.hide_adult_content == null) return;
    setHideAdultContent(Boolean(profileQuery.data.hide_adult_content));
  }, [isAuthenticated, profileQuery.data?.hide_adult_content, setHideAdultContent]);

  const debouncedQ = useDebouncedValue(searchQuery, 500);
  const debouncedFilters = useDebouncedValue(filters, 500);

  const searchAdsFilterKey = useMemo(
    () => ({
      genre_ids: filters.genres ?? [],
      tag_ids: filters.tags ?? [],
      fandom_ids: filters.fandoms ?? [],
    }),
    [filters.genres, filters.tags, filters.fandoms]
  );

  const effectiveFilters = useMemo<SearchFilters>(
    () => ({
      ...debouncedFilters,
      title: debouncedQ,
      adult_content: !hideAdultContent,
    }),
    [debouncedFilters, debouncedQ, hideAdultContent]
  );

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: catalogApi.getGenres,
    staleTime: 10 * 60 * 1000,
  });
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });
  const countriesQuery = useQuery({
    queryKey: ["countries"],
    queryFn: catalogApi.getCountries,
    staleTime: 10 * 60 * 1000,
  });
  const fandomsQuery = useQuery({
    queryKey: ["fandoms"],
    queryFn: catalogApi.getFandoms,
    staleTime: 10 * 60 * 1000,
  });

  const searchQueryResult = useQuery({
    queryKey: ["search-books", effectiveFilters, isAuthenticated ? userId : null, authReady],
    queryFn: () => searchBooks(effectiveFilters),
    staleTime: 0,
  });

  useEffect(() => {
    const q = debouncedQ.trim();
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const next = new URLSearchParams(searchParams);
    if (q) next.set("q", q);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }, [debouncedQ, searchParams, setSearchParams]);

  const runSearchNow = async () => {
    setIsForceFetching(true);
    setForcedError(null);
    const nextFilters: SearchFilters = {
      ...filters,
      title: searchQuery,
      adult_content: !hideAdultContent,
    };
    try {
      const data = await queryClient.fetchQuery({
        queryKey: [
          "search-books-forced",
          nextFilters,
          isAuthenticated ? userId : null,
          authReady,
          Date.now(),
        ],
        queryFn: () => searchBooks(nextFilters),
      });
      setForcedData(data);
      setForcedUpdatedAt(Date.now());
    } catch {
      setForcedError("Не вдалося виконати пошук. Спробуйте ще раз.");
    } finally {
      setIsForceFetching(false);
    }
  };

  const remoteBooks = useMemo(() => {
    const autoUpdatedAt = searchQueryResult.dataUpdatedAt ?? 0;
    if (forcedData && forcedUpdatedAt > autoUpdatedAt) return forcedData;
    return searchQueryResult.data ?? [];
  }, [forcedData, forcedUpdatedAt, searchQueryResult.data, searchQueryResult.dataUpdatedAt]);

  const filteredBooks = useMemo(() => {
    return remoteBooks.filter((book) => {
      if (checkValues.noFandoms && (book.fandoms?.length ?? 0) > 0) return false;
      if (
        checkValues.ready100 &&
        book.original_status_display !== "Завершено" &&
        book.original_status_display !== "Завершений"
      ) {
        return false;
      }
      if (checkValues.originalOnly && book.book_type !== "AUTHOR") return false;
      if (checkValues.hideBookmarks && book.bookmark_status != null) return false;
      return true;
    });
  }, [checkValues, remoteBooks]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredBooks.length, effectiveFilters, checkValues]);

  const isLoading = searchQueryResult.isFetching || isForceFetching;
  const hasError = searchQueryResult.isError || forcedError != null;
  const visibleBooks = filteredBooks.slice(0, visibleCount);

  const closePanel = () => {
    setActivePanel(null);
    setActivePanelAnchor(null);
  };

  const openPanel = (panel: FilterPanel, anchor: HTMLElement) => {
    setActivePanel(panel);
    setActivePanelAnchor(anchor);
  };

  const applyMultiSelect = (key: MultiFilterKey, id: number) => {
    setFilters((prev) => ({
      ...prev,
      [key]: toggleId(prev[key] ?? [], id),
    }));
  };

  const getOptions = (): Array<BookMetaItem | BookCountry> => {
    if (activePanel === "genres" || activePanel === "exclude_genres") return genresQuery.data ?? [];
    if (activePanel === "tags" || activePanel === "exclude_tags") return tagsQuery.data ?? [];
    if (activePanel === "fandoms" || activePanel === "exclude_fandoms") return fandomsQuery.data ?? [];
    if (activePanel === "countries") return countriesQuery.data ?? [];
    return [];
  };

  const groupedTagOptions = useMemo(() => {
    const tags = tagsQuery.data ?? [];
    if (!tags.length) return [];
    const byGroup = new Map<string, TagWithGroup[]>();
    for (const tag of tags) {
      const key = tag.group?.name ?? "Інше";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)?.push(tag);
    }
    return Array.from(byGroup.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, list]) => ({
        name,
        tags: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [tagsQuery.data]);

  const isOptionsLoading =
    (activePanel === "genres" || activePanel === "exclude_genres") ? genresQuery.isLoading
    : (activePanel === "tags" || activePanel === "exclude_tags") ? tagsQuery.isLoading
    : (activePanel === "fandoms" || activePanel === "exclude_fandoms") ? fandomsQuery.isLoading
    : activePanel === "countries" ? countriesQuery.isLoading
    : false;

  const activeSelection =
    activePanel && activePanel !== "chapters" ? (filters[activePanel] ?? []) : [];

  const toggleExtraCheck = (key: keyof typeof checkValues) => {
    setCheckValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAdultSearchToggle = async (nextHideAdultContent: boolean) => {
    setHideAdultContent(nextHideAdultContent);

    if (!isAuthenticated) return;

    try {
      if (!nextHideAdultContent) {
        await updateNotificationSettings({
          hide_adult_content: false,
          age_confirmed: true,
        });
        showWarning("Увага! Налаштування Профілю, стосовно контенту 18+, було змінено!");
      } else {
        await updateNotificationSettings({
          hide_adult_content: true,
          age_confirmed: false,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      showError("Не вдалося оновити налаштування 18+.");
      setHideAdultContent(!nextHideAdultContent);
    }
  };

  const confirmEnableAdultRestriction = () => {
    setAdultRestrictionConfirmOpen(false);
    void handleAdultSearchToggle(true);
  };

  const cancelEnableAdultRestriction = () => {
    setAdultRestrictionConfirmOpen(false);
  };

  return (
    <section className="abandoned-page">
      <Container>
        <div className="abandoned-layout">
          <div className="abandoned-main-col">
            <PageTitle>Пошук</PageTitle>

            <p className="abandoned-note">*Результати пошуку за заданими параметрами</p>

            <AdvertisingCarousel
              queryKey={advertisingKeys.searchAds(searchAdsFilterKey)}
              queryFn={() =>
                getSearchAds({
                  genre_ids: searchAdsFilterKey.genre_ids,
                  tag_ids: searchAdsFilterKey.tag_ids,
                  fandom_ids: searchAdsFilterKey.fandom_ids,
                })
              }
              withContainer={false}
            />

            <div className="abandoned-search-row">
              <label className="abandoned-search" aria-label="Пошук">
                <input
                  className="abandoned-search-input"
                  type="search"
                  placeholder="Пошук"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runSearchNow();
                    }
                  }}
                />
                <button
                  className="abandoned-search-btn"
                  type="button"
                  aria-label="Пошук"
                  onClick={() => {
                    void runSearchNow();
                  }}
                >
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
              <div className="abandoned-shown">Показано {filteredBooks.length} робіт</div>

              <div className="abandoned-sort">
                <SortByNavigation
                  value={filters.order ?? "-chapter_count"}
                  options={[...SORT_OPTIONS]}
                  onChange={(nextValue) =>
                    setFilters((prev) => ({
                      ...prev,
                      order: nextValue,
                    }))
                  }
                  ariaLabel="Сортування результатів пошуку"
                  labelText="Сортувати за"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="abandoned-state">Пошук книг…</div>
            ) : hasError ? (
              <div className="abandoned-state abandoned-state-error">
                {forcedError ?? "Не вдалося виконати пошук. Спробуйте ще раз."}
              </div>
            ) : visibleBooks.length === 0 ? (
              <div className="abandoned-state">Книг за цими параметрами не знайдено.</div>
            ) : (
              <>
                <div className="abandoned-grid">
                  {visibleBooks.map((book) => (
                    <div key={book.id} className="abandoned-card-cell">
                      <div className="abandoned-card-surface">
                        <BookCard book={book} variant="withTags" />
                      </div>
                    </div>
                  ))}
                </div>

                <ShowMoreNavigation
                  visibleCount={visibleCount}
                  totalCount={filteredBooks.length}
                  onShowMore={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  ariaLabel="Показати ще результати пошуку"
                />
              </>
            )}
          </div>

          <FiltersSidebar sidebarClassName="abandoned-sidebar">
            <div className="filters-panel">
              <h2 className="filters-title">Фільтри</h2>

              <div className="filters-list" role="list">
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("genres", event.currentTarget)}
                >
                  <span>Жанри ({filters.genres?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("fandoms", event.currentTarget)}
                >
                  <span>Фендоми ({filters.fandoms?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("tags", event.currentTarget)}
                >
                  <span>Теги ({filters.tags?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("countries", event.currentTarget)}
                >
                  <span>Країни ({filters.countries?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("exclude_genres", event.currentTarget)}
                >
                  <span>Виключити жанри ({filters.exclude_genres?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("exclude_fandoms", event.currentTarget)}
                >
                  <span>Виключити фендоми ({filters.exclude_fandoms?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("exclude_tags", event.currentTarget)}
                >
                  <span>Виключити теги ({filters.exclude_tags?.length ?? 0})</span>
                  <span className="filters-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  className="filters-item"
                  type="button"
                  role="listitem"
                  onClick={(event) => openPanel("chapters", event.currentTarget)}
                >
                  <span>Кількість розділів ({filters.min_chapters || 0}-{filters.max_chapters || "∞"})</span>
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
                  aria-pressed={hideAdultContent}
                  onClick={() => {
                    const nextHideAdultContent = !hideAdultContent;
                    if (nextHideAdultContent) {
                      setAdultRestrictionConfirmOpen(true);
                      return;
                    }
                    void handleAdultSearchToggle(false);
                  }}
                >
                  <Icon
                    name={hideAdultContent ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Обмеження за віком 18+</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Без фендомів"
                  aria-pressed={checkValues.noFandoms}
                  onClick={() => toggleExtraCheck("noFandoms")}
                >
                  <Icon
                    name={checkValues.noFandoms ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Без фендомів</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Готові на 100%"
                  aria-pressed={checkValues.ready100}
                  onClick={() => toggleExtraCheck("ready100")}
                >
                  <Icon
                    name={checkValues.ready100 ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Готові на 100%</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Тільки переглянуті"
                  aria-pressed={checkValues.viewedOnly}
                  onClick={() => toggleExtraCheck("viewedOnly")}
                >
                  <Icon
                    name={checkValues.viewedOnly ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Тільки переглянуті</span>
              </label>

              <label className="filters-check">
                <button
                  className="filters-checkbox-btn"
                  type="button"
                  aria-label="Не показувати закладки"
                  aria-pressed={checkValues.hideBookmarks}
                  onClick={() => {
                    if (!authReady || !isAuthenticated) {
                      showWarning("Увійдіть, щоб приховати закладки.");
                      return;
                    }
                    toggleExtraCheck("hideBookmarks");
                  }}
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
                  onClick={() => toggleExtraCheck("originalOnly")}
                >
                  <Icon
                    name={checkValues.originalOnly ? "content_checkbox_checked" : "content_checkbox"}
                    aria-hidden
                  />
                </button>
                <span>Тільки оригінал</span>
              </label>

              <button
                className="filters-submit"
                type="button"
                onClick={() => {
                  void runSearchNow();
                }}
              >
                Пошук
              </button>
            </div>
          </FiltersSidebar>
        </div>
      </Container>

      <FilterDropdown
        open={activePanel !== null}
        anchorEl={activePanelAnchor}
        onClose={closePanel}
        align="end"
        className="search-filter-dropdown"
      >
        <div className="search-filter-dropdown-inner">
          <div className="search-filter-dropdown-header">
            <span className="search-filter-dropdown-title">
              {activePanel === "chapters"
                ? "Кількість розділів"
                : activePanel
                  ? FILTER_LABELS[activePanel]
                  : ""}
            </span>
            <button className="search-filter-close" type="button" onClick={closePanel}>
              Закрити
            </button>
          </div>

          {activePanel === "chapters" ? (
            <div className="search-chapters-grid">
              <label className="search-chapters-field">
                <span>Мінімум розділів</span>
                <input
                  className="search-chapters-input"
                  type="number"
                  min={0}
                  value={filters.min_chapters}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      min_chapters: parseNumberInput(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="search-chapters-field">
                <span>Максимум розділів</span>
                <input
                  className="search-chapters-input"
                  type="number"
                  min={0}
                  value={filters.max_chapters}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      max_chapters: parseNumberInput(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          ) : (
            <div className="search-filter-options-wrap">
              {isOptionsLoading ? (
                <div className="search-filter-empty">Завантаження…</div>
              ) : (activePanel === "tags" || activePanel === "exclude_tags") &&
                groupedTagOptions.length > 0 ? (
                <div className="search-tag-groups">
                  {groupedTagOptions.map((group) => (
                    <div key={group.name} className="search-tag-group">
                      <div className="search-tag-group-header">
                        <span className="search-tag-group-title">{group.name}</span>
                        <span className="search-tag-group-line" aria-hidden="true" />
                      </div>
                      <div className="search-filter-options-grid">
                        {group.tags.map((item) => {
                          const checked = activeSelection.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              className={checked ? "search-filter-chip search-filter-chip-selected" : "search-filter-chip"}
                              type="button"
                              onClick={() => {
                                if (activePanel) {
                                  applyMultiSelect(activePanel, item.id);
                                }
                              }}
                            >
                              {item.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : getOptions().length === 0 ? (
                <div className="search-filter-empty">Немає даних для цього фільтра.</div>
              ) : (
                <div className="search-filter-options-grid">
                  {getOptions().map((item) => {
                    const checked = activeSelection.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        className={checked ? "search-filter-chip search-filter-chip-selected" : "search-filter-chip"}
                        type="button"
                        onClick={() => {
                          if (activePanel) {
                            applyMultiSelect(activePanel, item.id);
                          }
                        }}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </FilterDropdown>

      <Modal
        open={adultRestrictionConfirmOpen}
        onClose={cancelEnableAdultRestriction}
        title="Підтвердження 18+"
      >
        <div className="search-modal-content">
          <p className="search-modal-hint">
            Ви впевнені, що хочете прибрати контент 18+ з усіх сторінок?
          </p>
          <div className="search-modal-actions">
            <button type="button" className="filters-submit" onClick={cancelEnableAdultRestriction}>
              Скасувати
            </button>
            <button type="button" className="filters-submit" onClick={confirmEnableAdultRestriction}>
              Підтвердити
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
