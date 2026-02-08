import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { BookAdCard } from "../website_advertising/BookAdCard/BookAdCard";
import { getUserBookmarks } from "./api";
import { bookmarkKeys } from "./keys";
import type { Bookmark as BookmarkType, BookmarkBook } from "./types";
import styles from "./BookmarksPage.module.css";
import badge18 from "../assets/backgrounds/18+.svg";
import coverPlaceholder from "../assets/1SR-gLCHT4s.jpg";

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Усі" },
  { value: "special", label: "Особливі" },
  { value: "reading", label: "Читаю" },
  { value: "planned", label: "В планах" },
  { value: "dropped", label: "Покинуті" },
  { value: "completed", label: "Прочитані" },
];

function getImageUrl(book: BookmarkBook): string {
  const img = book.image;
  if (!img) return "";
  if (img.startsWith("http")) return img;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}${img}` : img;
}

function BookmarkCard({ bookmark }: { bookmark: BookmarkType }) {
  const navigate = useNavigate();
  const book = bookmark.book;
  const slug = book.slug;
  const imageUrl = getImageUrl(book) || "";

  const handleRead = () => {
    if (slug) navigate(`/books/${slug}`);
  };

  const card = (
    <BookAdCard
      variant="bookmark"
      coverSrc={imageUrl || coverPlaceholder}
      title={book.title || "Без назви"}
      isAdult={book.adult_content === true}
      adultBadgeSrc={badge18}
      onRead={handleRead}
    />
  );

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
  const { isAuthenticated, userId, authReady } = useAuth();

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

  if (!authReady) {
    return (
      <section className={styles.page}>
        <Container>
          <div className={styles.loading}>Завантаження…</div>
        </Container>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <Container>
          <div className={styles.authRequired}>
            <h2>Для перегляду закладок необхідно увійти в систему</h2>
            <p>Увійдіть або зареєструйтесь, щоб мати доступ до ваших закладок</p>
            <Link to="/login">
              <ActionButton variant="primary">Увійти</ActionButton>
            </Link>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Container>
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <h1 className={styles.title}>Закладки</h1>
            <p className={styles.subtitle}>
              *Радимо Вам додавати книги, які Вам сподобалися — це допоможе в
              покращенні рекомендацій цікавих творів іншим користувачам сайту
            </p>

            <div className={styles.topBar}>
              <span className={styles.shownCount}>
                Показано {bookmarks.length} робіт
              </span>
              <div className={styles.sortWrap}>
                <label htmlFor="sort-select" className={styles.sortLabel}>
                  Сортувати за
                </label>
                <select
                  id="sort-select"
                  className={styles.sortSelect}
                  defaultValue=""
                  aria-label="Сортувати за"
                >
                  <option value="" disabled>
                    Вибрати
                  </option>
                </select>
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
              <div className={styles.grid}>
                {bookmarks.map((bookmark, index) => {
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

          <aside className={styles.sidebar}>
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
          </aside>
        </div>
      </Container>
    </section>
  );
}
