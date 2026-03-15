import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SortByNavigation } from "../navigation/SortByNavigation.tsx";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { BookCard } from "../BookCard/BookCard";
import { getUserBookmarks } from "./api";
import { bookmarkKeys } from "./keys";
import type { Bookmark as BookmarkType } from "./types";
import styles from "./BookmarksPage.module.css";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { PageTitle } from "../navigation/PageTitle";
import { FiltersSidebar } from "../navigation/FiltersSidebar";

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Усі" },
  { value: "special", label: "Особливі" },
  { value: "reading", label: "Читаю" },
  { value: "planned", label: "В планах" },
  { value: "dropped", label: "Покинуті" },
  { value: "completed", label: "Прочитані" },
];
const PAGE_SIZE = 10;
type SortKey = "updated" | "created" | "title";
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "updated", label: "Останньою активністю" },
  { value: "created", label: "Датою створення" },
  { value: "title", label: "Назвою" },
];

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function BookmarkCard({ bookmark }: { bookmark: BookmarkType }) {
  const book = bookmark.book;
  const slug = book.slug;
  const card = <BookCard book={book} variant="bookmark" />;

  if (slug) {
    return (
      <Link to={`/books/${slug}`} className={styles.cardLink}>
        {card}
      </Link>
    );
  }

  return (
    <div className={styles.cardNoLink} title="Посилання недоступне">
      {card}
    </div>
  );
}

export default function BookmarksPage() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { isAuthenticated, userId, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();

  const {
    data: bookmarks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: bookmarkKeys.list(userId ?? 0, selectedStatus),
    queryFn: () =>
      getUserBookmarks(selectedStatus === "special" ? "all" : selectedStatus),
    enabled: isAuthenticated && !!userId && authReady,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const sortedBookmarks = useMemo(() => {
    const copy = [...bookmarks];
    if (sortBy === "updated") {
      copy.sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at));
    } else if (sortBy === "created") {
      copy.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
    } else {
      copy.sort((a, b) => a.book.title.localeCompare(b.book.title, "uk-UA"));
    }
    return copy;
  }, [bookmarks, sortBy]);

  const visibleBookmarks = useMemo(
    () => sortedBookmarks.slice(0, visibleCount),
    [sortedBookmarks, visibleCount]
  );
  const showMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedStatus, sortBy, bookmarks.length]);

  if (!authReady) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Закладки" }]} />
          <div className={styles.loading}>Завантаження…</div>
        </Container>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Закладки" }]} />
          <div className={styles.authRequired}>
            <h2>Для перегляду закладок необхідно увійти в систему</h2>
            <p>Увійдіть або зареєструйтесь, щоб мати доступ до ваших закладок</p>
            <ActionButton variant="primary" onClick={() => openLoginModal("/bookmarks")}>
              Увійти
            </ActionButton>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Container className={styles.bookmarksContainer}>
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Закладки" }]} />
            <PageTitle>Закладки</PageTitle>
            <p className={styles.subtitle}>
              *Радимо Вам додавати книги, які Вам сподобалися — це допоможе в
              покращенні рекомендацій цікавих творів іншим користувачам сайту
            </p>

            <div className={styles.topBar}>
              <span className={styles.shownCount}>
                Показано {visibleBookmarks.length} робіт
              </span>
              <div className={styles.topBarFoundRow}>
                <span className={styles.foundLabel}>Знайдено:</span>
                <div className={styles.bookmarkRibbon}>
                  <span className={styles.bookmarkCount}>{bookmarks.length}</span>
                  <span className={styles.bookmarkWord}>закладок</span>
                </div>
              </div>
              <div className={styles.sortWrap}>
                <SortByNavigation
                  value={sortBy}
                  options={SORT_OPTIONS}
                  onChange={(nextValue) => setSortBy(nextValue as SortKey)}
                  ariaLabel="Сортувати закладки"
                  labelText="Сортувати за"
                />
              </div>
            </div>

            {error ? (
              <div className={styles.error}>
                <p>Помилка завантаження закладок</p>
                <ActionButton
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  Спробувати ще раз
                </ActionButton>
              </div>
            ) : isLoading ? (
              <div className={styles.loading}>Завантаження закладок…</div>
            ) : bookmarks.length > 0 ? (
              <>
                <div className={styles.grid}>
                  {visibleBookmarks.map((bookmark, index) => {
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    const hasGradient = (row + col) % 2 === 1;
                    return (
                      <div
                        key={bookmark.id}
                        className={hasGradient ? styles.cardWithGradient : ""}
                      >
                        <BookmarkCard bookmark={bookmark} />
                      </div>
                    );
                  })}
                </div>
                <ShowMoreNavigation
                  className={styles.showMore}
                  visibleCount={visibleCount}
                  totalCount={sortedBookmarks.length}
                  onShowMore={showMore}
                  ariaLabel="Показати ще закладки"
                />
              </>
            ) : (
              <div className={styles.empty}>
                <h3 className={styles.emptyTitle}>
                  У вас поки немає закладок
                </h3>
                <p className={styles.emptyText}>
                  Перейдіть на сторінку каталогу або пошуку аби знайти твори, які
                  вам сподобаються та додайте обрані книги в свої закладки, щоб
                  вони з&apos;явилися тут.
                </p>
                <ActionButton
                  as="a"
                  href="/"
                  variant="bookFrame"
                  className={styles.emptyBtn}
                  ariaLabel="Переглянути каталог"
                >
                  Переглянути каталог
                </ActionButton>
              </div>
            )}
          </div>

          <FiltersSidebar
            sidebarClassName={styles.sidebar}
            modalContentClassName={styles.bookmarksModalContent}
          >
            <h2 className={styles.sidebarTitle}>Фільтри</h2>
            <div className={styles.filterBox}>
              {FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filterItem} ${
                    selectedStatus === value ? styles.filterItemActive : ""
                  }`}
                  onClick={() => setSelectedStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.foundRow}>
              <span className={styles.foundLabel}>Знайдено:</span>
              <div className={styles.bookmarkRibbon}>
                <span className={styles.bookmarkCount}>{bookmarks.length}</span>
                <span className={styles.bookmarkWord}>закладок</span>
              </div>
            </div>
          </FiltersSidebar>
        </div>
      </Container>
    </section>
  );
}
