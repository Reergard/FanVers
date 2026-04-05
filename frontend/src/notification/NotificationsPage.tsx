import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import styles from "./NotificationsPage.module.css";
import { Container } from "../shared/Container";
import { ShowMoreNavigation } from "../navigation/ShowMoreNavigation.tsx";
import { SaveButton } from "../shared/SaveButton/SaveButton";
import { FilterCheckbox } from "../shared/FilterCheckbox/FilterCheckbox";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { Modal } from "../shared/Modal/Modal";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { useNotifications } from "./useNotifications";
import { getNotificationById } from "./notificationsService";
import { parseErrorReportSuggestion } from "./parseErrorReportSuggestion";
import { getMyProfile, updateNotificationSettings } from "../users/profileService";
import type { AppNotification } from "./types";
import type { NotificationSettingsPatch } from "../users/types";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { PageTitle } from "../navigation/PageTitle";
import { FiltersSidebar } from "../navigation/FiltersSidebar";

const NOTIFICATION_FILTERS: { key: keyof NotificationSettingsPatch; label: string }[] = [
  { key: "comment_notifications", label: "Коментарі у ваших постах та відповіді на ваші коментарі" },
  { key: "translation_status_notifications", label: "Зміна статусу перекладу" },
  { key: "chapter_subscription_notifications", label: "Зняття розділу з передплати" },
  { key: "chapter_comment_notifications", label: "Коментарі до розділу" },
];

const NOTIFICATION_MODAL_EXTRA_ITEMS: string[] = [
  "Помилка в тексті",
  "Отримання перекладу від іншого перекладача",
  "Зміна статусу замовлення реклами",
  "Вихід нових розділів",
  "Коментарі до книг",
];
const PAGE_SIZE = 10;

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
  const [activeReport, setActiveReport] = useState<AppNotification | null>(null);
  const [reportDetail, setReportDetail] = useState<AppNotification | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);

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

  useEffect(() => {
    if (!activeReport?.id) {
      setReportDetail(null);
      setReportDetailLoading(false);
      return;
    }
    if (!activeReport.error_report_id) {
      setReportDetail(activeReport);
      setReportDetailLoading(false);
      return;
    }
    let cancelled = false;
    setReportDetailLoading(true);
    setReportDetail(null);
    getNotificationById(activeReport.id)
      .then((full) => {
        if (!cancelled) setReportDetail(full);
      })
      .catch(() => {
        if (!cancelled) setReportDetail(activeReport);
      })
      .finally(() => {
        if (!cancelled) setReportDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeReport]);

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
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Повідомлення" }]} />
          <div className={styles.loading}>Завантаження…</div>
        </Container>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <Container>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Повідомлення" }]} />
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

  const errorReportModalData = activeReport ? (reportDetail ?? activeReport) : null;
  const errorReportParsed = errorReportModalData
    ? parseErrorReportSuggestion(errorReportModalData.suggestion)
    : { typeLabel: "—", comment: "—" };

  return (
    <section className={styles.page}>
      <Container>
        <header className={styles.header}>
          <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Повідомлення" }]} />
          <PageTitle>Повідомлення</PageTitle>

          <div className={styles.headerMid}>
            <span className={styles.count}>
              Усього {notifications.length} {pluralize(notifications.length)}
            </span>
            <span className={styles.topLine} aria-hidden="true" />
          </div>
        </header>

        <div className={styles.layout}>
          {/* LEFT: filters card (desktop) / floating button + modal (mobile) */}
          <FiltersSidebar
            sidebarClassName={styles.sidebar}
            modalClassName={styles.notificationModal}
            modalContentClassName={styles.notificationModalWrapper}
            modalCloseBtnClassName={styles.notificationModalCloseBtn}
            modalChildren={
              <div className={styles.notificationModalPanel}>
                <div className={styles.notificationModalFrame} aria-hidden="true" />
                <div className={styles.notificationModalScroll}>
                  <div className={styles.notificationModalContent}>
                    <div className={styles.notificationModalInner}>
                    <h2 className={styles.notificationModalTitle}>ПОВІДОМЛЕННЯ</h2>
                    <form
                      className={styles.notificationModalForm}
                      onSubmit={(e) => e.preventDefault()}
                    >
                      <div className={styles.notificationModalOptions}>
                        {NOTIFICATION_FILTERS.map(({ key, label }, idx) => {
                          const id = `msg-modal-filter-${idx}`;
                          return (
                            <label
                              key={id}
                              className={styles.notificationModalOption}
                              htmlFor={id}
                            >
                              <input
                                type="checkbox"
                                id={id}
                                checked={filters[key] ?? true}
                                onChange={(e) =>
                                  handleFilterChange(key as keyof NotificationSettingsPatch, e.target.checked)
                                }
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                        {NOTIFICATION_MODAL_EXTRA_ITEMS.map((label, idx) => {
                          const id = `msg-modal-extra-${idx}`;
                          return (
                            <label
                              key={id}
                              className={`${styles.notificationModalOption} ${styles.notificationModalOptionDisabled}`}
                              htmlFor={id}
                            >
                              <input
                                type="checkbox"
                                id={id}
                                disabled
                                defaultChecked={false}
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className={styles.notificationModalActions}>
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
                </div>
                </div>
              </div>
            }
            hideModalTitle
          >
            <div className={styles.filtersWrapper}>
              <div className={styles.frame} aria-hidden="true" />
              <div className={styles.sidebarInner}>
                <h2 className={styles.sidebarTitle}>ПОВІДОМЛЕННЯ</h2>

                <div className={styles.filtersFrame}>
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
              </div>
            </div>
          </FiltersSidebar>

          {/* RIGHT: messages list */}
          <main className={styles.content} aria-label="Список повідомлень">
            <div className={styles.contentHeader}>
              <span className={styles.contentCount}>
                Показано {visibleNotifications.length} {pluralize(visibleNotifications.length)}
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
                          {m.error_report_id && (
                            <>
                              {" "}
                              <button
                                type="button"
                                className={styles.detailsBtn}
                                onClick={() => setActiveReport(m)}
                              >
                                Натисніть аби побачити деталі помилки
                              </button>
                            </>
                          )}
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
      <Modal
        open={activeReport != null}
        onClose={() => {
          setActiveReport(null);
          setReportDetail(null);
        }}
        title="Деталі помилки"
      >
        {activeReport && errorReportModalData && (
          <div className={styles.reportDetail}>
            {reportDetailLoading && (
              <p className={styles.reportDetailLoading}>Завантаження деталей…</p>
            )}
            <div className={styles.reportDetailRow}>
              <span className={styles.reportDetailLabel}>Ким знайдено</span>
              <span className={styles.reportDetailValue}>
                {errorReportModalData.reporter_username ?? "—"}
              </span>
            </div>
            <div className={styles.reportDetailRow}>
              <span className={styles.reportDetailLabel}>Дата</span>
              <span className={styles.reportDetailValue}>
                {errorReportModalData.created_at ? formatDate(errorReportModalData.created_at) : "—"}
              </span>
            </div>
            <div className={styles.reportDetailRow}>
              <span className={styles.reportDetailLabel}>Книга</span>
              <span className={styles.reportDetailValue}>{errorReportModalData.book_title ?? "—"}</span>
            </div>
            <div className={styles.reportDetailRow}>
              <span className={styles.reportDetailLabel}>Розділ</span>
              <span className={styles.reportDetailValue}>{errorReportModalData.chapter_title ?? "—"}</span>
            </div>
            <div className={styles.reportDetailRow}>
              <span className={styles.reportDetailLabel}>Тип помилки</span>
              <span className={styles.reportDetailValue}>{errorReportParsed.typeLabel}</span>
            </div>
            <div className={styles.reportDetailSection}>
              <span className={styles.reportDetailLabel}>Фрагмент з помилкою</span>
              <div className={styles.reportDetailBox}>
                {errorReportModalData.error_text?.trim() || "—"}
              </div>
            </div>
            <div className={styles.reportDetailSection}>
              <span className={styles.reportDetailLabel}>Коментар</span>
              <div className={styles.reportDetailBoxTall}>{errorReportParsed.comment}</div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
