import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import styles from "./NotificationsPage.module.css";
import { Container } from "../shared/Container";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SaveButton } from "../shared/SaveButton/SaveButton";
import { FilterCheckbox } from "../shared/FilterCheckbox/FilterCheckbox";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { useNotifications } from "./useNotifications";
import { getMyProfile, updateNotificationSettings } from "../users/profileService";
import type { AppNotification } from "./types";
import type { NotificationSettingsPatch } from "../users/types";

const NOTIFICATION_FILTERS: { key: keyof NotificationSettingsPatch; label: string }[] = [
  { key: "comment_notifications", label: "Коментарі у ваших постах та відповіді на ваші коментарі" },
  { key: "translation_status_notifications", label: "Зміна статусу перекладу" },
  { key: "chapter_subscription_notifications", label: "Зняття розділу з передплати" },
  { key: "chapter_comment_notifications", label: "Коментарі до розділу" },
];
const PAGE_SIZE = 1;

function pluralize(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "повідомлення";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "повідомлення";
  return "повідомлень";
}

function formatDate(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleString("uk-UA");
  } catch {
    return createdAt;
  }
}

export function NotificationsPage() {
  const { isAuthenticated, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();
  const { query, markRead, remove } = useNotifications(isAuthenticated);

  const [filters, setFilters] = useState<Partial<Record<keyof NotificationSettingsPatch, boolean>>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: isAuthenticated,
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile) {
      const next: Partial<Record<keyof NotificationSettingsPatch, boolean>> = {};
      NOTIFICATION_FILTERS.forEach(({ key }) => {
        const val = profile[key as keyof typeof profile];
        next[key] = typeof val === "boolean" ? val : true;
      });
      setFilters(next);
    }
  }, [profile]);

  const saveFiltersMutation = useMutation({
    mutationFn: (patch: NotificationSettingsPatch) => updateNotificationSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess("Налаштування збережено");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showError(msg ?? "Помилка при збереженні");
    },
  });

  const notifications = query.data?.notifications ?? [];
  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount]
  );
  const showMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);
  const isLoading = query.isLoading;
  const isError = query.isError;
  const refetch = query.refetch;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [notifications.length]);

  const handleFilterChange = (key: keyof NotificationSettingsPatch, checked: boolean) => {
    setFilters((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSaveFilters = () => {
    const patch: NotificationSettingsPatch = {};
    NOTIFICATION_FILTERS.forEach(({ key }) => {
      if (key in filters && typeof filters[key] === "boolean") {
        patch[key] = filters[key]!;
      }
    });
    saveFiltersMutation.mutate(patch);
  };

  const profileLoaded = !profileQuery.isLoading && !!profile;
  const canSaveFilters = profileLoaded && Object.keys(filters).length > 0;

  const handleMarkAsRead = (id: number | string) => {
    markRead.mutate(id);
  };

  const handleDelete = (id: number | string) => {
    remove.mutate(id, {
      onSuccess: () => showSuccess("Повідомлення видалено"),
      onError: () => showError("Помилка при видаленні повідомлення"),
    });
  };

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
            <h2>Для перегляду повідомлень необхідно увійти в систему</h2>
            <p>Увійдіть або зареєструйтесь, щоб мати доступ до ваших повідомлень</p>
            <ActionButton variant="primary" onClick={() => openLoginModal("/messages")}>
              Увійти
            </ActionButton>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Container>
        <header className={styles.header}>
          <h1 className={styles.title}>Повідомлення</h1>

          <div className={styles.headerMid}>
            <span className={styles.count}>
              Показано {notifications.length} {pluralize(notifications.length)}
            </span>
            <span className={styles.topLine} aria-hidden="true" />
          </div>
        </header>

        <div className={styles.layout}>
          {/* LEFT: filters card */}
          <aside className={styles.sidebar} aria-label="Фільтри повідомлень">
            <div className={styles.frame} aria-hidden="true" />
            <div className={styles.sidebarInner}>
              <h2 className={styles.sidebarTitle}>ПОВІДОМЛЕННЯ</h2>

              <form className={styles.filters} onSubmit={(e) => e.preventDefault()}>
                {NOTIFICATION_FILTERS.map(({ key, label }, idx) => {
                  const id = `msg-filter-${idx}`;
                  return (
                    <FilterCheckbox
                      key={id}
                      id={id}
                      label={label}
                      checked={filters[key] ?? true}
                      onChange={(checked) => handleFilterChange(key as keyof NotificationSettingsPatch, checked)}
                    />
                  );
                })}

                <div className={styles.sidebarActions}>
                  <SaveButton
                    type="button"
                    onClick={handleSaveFilters}
                    variant="default"
                    disabled={!canSaveFilters || saveFiltersMutation.isPending}
                    loading={saveFiltersMutation.isPending}
                  />
                </div>
              </form>
            </div>
          </aside>

          {/* RIGHT: messages list */}
          <main className={styles.content} aria-label="Список повідомлень">
            <div className={styles.contentHeader}>
              <span className={styles.contentCount}>
                Показано {notifications.length} {pluralize(notifications.length)}
              </span>
              <span className={styles.contentLine} aria-hidden="true" />
            </div>

            {isError ? (
              <div className={styles.error}>
                <p>Помилка завантаження повідомлень</p>
                <ActionButton
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  Спробувати ще раз
                </ActionButton>
              </div>
            ) : isLoading ? (
              <div className={styles.loading}>Завантаження повідомлень…</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.itemTitlePill}>Немає повідомлень</div>
                <p className={styles.itemText}>У вас поки немає повідомлень</p>
              </div>
            ) : (
              <>
                <ul className={styles.list}>
                  {visibleNotifications.map((m: AppNotification, idx: number) => (
                    <li key={m.id} className={styles.itemWrap}>
                      <article className={styles.item}>
                        <div className={styles.itemTitlePill}>
                          Повідомлення {idx + 1}
                          {!m.is_read && <span className={styles.unreadDot} />}
                        </div>

                        <p className={styles.itemText}>
                          {m.message || "Немає тексту повідомлення"}
                        </p>
                        {m.created_at && (
                          <small className={styles.itemDate}>{formatDate(m.created_at)}</small>
                        )}

                        <div className={styles.itemFooter}>
                          {!m.is_read && (
                            <button
                              type="button"
                              className={styles.markReadBtn}
                              onClick={() => handleMarkAsRead(m.id)}
                              disabled={markRead.isPending}
                            >
                              Позначити як прочитане
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(m.id)}
                            disabled={remove.isPending}
                          >
                            Видалити
                          </button>
                        </div>
                      </article>

                      <div className={styles.separator} aria-hidden="true" />
                    </li>
                  ))}
                </ul>
                <ShowMoreNavigation
                  className={styles.showMore}
                  visibleCount={visibleCount}
                  totalCount={notifications.length}
                  onShowMore={showMore}
                  ariaLabel="Показати ще повідомлення"
                />
              </>
            )}
          </main>
        </div>
      </Container>
    </section>
  );
}
