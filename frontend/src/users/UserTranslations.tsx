import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { Container } from "../shared/Container";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { UserTranslationCard } from "./UserTranslationCard/UserTranslationCard";
import { getUserTranslations, catalogKeys, type UserTranslationBook } from "../api/catalogApi";
import { getMyProfile } from "./profileService";
import styles from "./UserTranslations.module.css";

export default function UserTranslations() {
  const { isAuthenticated, userId, authReady } = useAuth();

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
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: isAuthenticated && !!userId && authReady,
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
            <h2>Для перегляду власних перекладів необхідно увійти в систему</h2>
            <p>
              Увійдіть або зареєструйтесь, щоб мати доступ до ваших перекладів
              та авторських творів
            </p>
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
            <h1 className={styles.title}>Власні переклади</h1>

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
              <div className={styles.grid}>
                {books.map((book: UserTranslationBook) => (
                  <div key={book.id} className={styles.cardCell}>
                    <UserTranslationCard book={book} />
                  </div>
                ))}
              </div>
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
