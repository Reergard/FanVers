import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { BookCard } from "../BookCard/BookCard";
import { getUserTranslations, catalogKeys, type UserTranslationBook } from "../api/catalogApi";
import { getMyProfile } from "./profileService";
import styles from "./UserTranslations.module.css";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { profileQueryKey } from "../shared/queryKeys";
import { PageTitle } from "../navigation/PageTitle";

const PAGE_SIZE = 10;

export default function UserTranslations() {
  const { isAuthenticated, userId, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const {
    data: books = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: catalogKeys.userTranslations(userId ?? 0),
    queryFn: getUserTranslations,
    enabled: isAuthenticated && !!userId && authReady,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const { data: profile } = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: getMyProfile,
    enabled: isAuthenticated && !!userId && authReady,
  });

  const visibleBooks = useMemo(
    () => books.slice(0, visibleCount),
    [books, visibleCount]
  );
  const showMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [books.length]);

  if (!authReady) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Власні твори" }]} />
          <div className={styles.loading}>Завантаження…</div>
        </Container>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Власні твори" }]} />
          <div className={styles.authRequired}>
            <h2>Для перегляду власних перекладів необхідно увійти в систему</h2>
            <p>
              Увійдіть або зареєструйтесь, щоб мати доступ до ваших перекладів
              та авторських творів
            </p>
            <ActionButton variant="primary" onClick={() => openLoginModal("/my-translations")}>
              Увійти
            </ActionButton>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className={`${styles.page} bookCard-mobile-grid`}>
      <Container>
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Власні твори" }]} />
            <PageTitle>Власні твори</PageTitle>

            {error ? (
              <div className={styles.error}>
                <p>Помилка завантаження перекладів</p>
                <ActionButton
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  Спробувати ще раз
                </ActionButton>
              </div>
            ) : isLoading ? (
              <div className={styles.loading}>Завантаження перекладів…</div>
            ) : books.length > 0 ? (
              <>
                <div className={styles.grid}>
                  {visibleBooks.map((book: UserTranslationBook) => (
                    <div key={book.id} className={styles.cardCell}>
                      <BookCard book={book} />
                    </div>
                  ))}
                </div>
                <ShowMoreNavigation
                  className={styles.showMore}
                  visibleCount={visibleCount}
                  totalCount={books.length}
                  onShowMore={showMore}
                  ariaLabel="Показати ще власні твори"
                />
              </>
            ) : (
              <div className={styles.empty}>
                <h3 className={styles.emptyTitle}>
                  У вас поки немає власних перекладів
                </h3>
                <p className={styles.emptyText}>
                  Створіть новий переклад або авторський твір у каталозі, щоб вони
                  з&apos;явилися тут.
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
            <h2 className={styles.sidebarTitle}>Статистика діяльності</h2>
            <div className={styles.statsBox}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Перекладів</span>
                <span className={styles.statValue}>
                  {profile?.total_translations ?? 0}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Сторінок переведено</span>
                <span className={styles.statValue}>
                  {profile?.total_chapters ?? 0}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Символів переклав</span>
                <span className={styles.statValue}>
                  {profile?.total_characters?.toLocaleString("uk-UA") ?? 0}
                </span>
              </div>
            </div>
            <div className={styles.commissionRow}>
              <span className={styles.commissionLabel}>Комісія</span>
              <div className={styles.commissionBanner}>
                <span className={styles.commissionValue}>
                  {profile?.commission != null
                    ? `${Number(profile.commission)}%`
                    : "15%"}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
}
