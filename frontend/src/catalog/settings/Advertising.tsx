import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { refreshAuthStatus } from "../../auth/service";
import { useBookBySlug } from "../hooks/useBookBySlug";
import { useBookFormMeta } from "../hooks/useBookFormMeta";
import {
  submitAdvertisingOrder,
  advertisingKeys,
  type CreateAdvertisementPayload,
} from "../../api/advertisingApi";
import { extractUserMessage } from "../../shared/utils/errorUtils";
import type { PlacementType } from "./advertising.types";
import { advertisingPlacements } from "./advertising.data";
import { PLACEMENT_AVAILABLE } from "./advertising.constants";
import { useAdvertisingOrder } from "./useAdvertisingOrder";
import styles from "./Advertising.module.css";

function parseBalance(value: string | number | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Placeholder: замінити на <svg><use href="#icon-calendar"/></svg> коли буде sprite */
function CalendarIcon() {
  return (
    <svg
      className={styles.dateIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/** Placeholder: замінити на SVG emblem коли буде готовий */
function ButtonEmblem() {
  return <span className={styles.orderButtonIcon} aria-hidden />;
}

export default function Advertising() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { userId, balance } = useAuth();
  const { data: book } = useBookBySlug(slug);
  const meta = useBookFormMeta();
  const queryClient = useQueryClient();

  const {
    placements,
    updatePlacement,
    addToOrder,
    removeFromOrder,
    totalCost,
    orderedPlacements,
    minStartDate,
  } = useAdvertisingOrder();

  const balanceNum = parseBalance(balance ?? undefined);

  const submitMutation = useMutation({
    mutationFn: (payload: { items: CreateAdvertisementPayload[] }) =>
      submitAdvertisingOrder(payload),
    onSuccess: async () => {
      await refreshAuthStatus();
      queryClient.invalidateQueries({ queryKey: advertisingKeys.userAds() });
      if (book?.id) {
        queryClient.invalidateQueries({
          queryKey: advertisingKeys.bookAds(book.id),
        });
      }
      showSuccess("Реклама успішно створена");
      navigate(`/books/${slug}`);
    },
    onError: async (err: unknown) => {
      showError(extractUserMessage(err, "Помилка при створенні реклами"));
      await refreshAuthStatus();
      queryClient.invalidateQueries({ queryKey: advertisingKeys.userAds() });
      if (book?.id) {
        queryClient.invalidateQueries({
          queryKey: advertisingKeys.bookAds(book.id),
        });
      }
    },
  });

  const handlePublish = () => {
    if (!book?.id) {
      showError("Помилка: некоректні дані книги");
      return;
    }
    if (userId == null || book.owner !== userId) {
      showError("У вас немає прав для редагування цієї книги");
      return;
    }
    if (orderedPlacements.length === 0) {
      showError("Будь ласка, додайте хоча б один тип реклами в заказ");
      return;
    }
    if (totalCost <= 0) {
      showError("Загальна вартість має бути більше нуля");
      return;
    }
    if (balanceNum < totalCost) {
      showError("Недостатньо коштів на балансі");
      return;
    }

    const payloads: CreateAdvertisementPayload[] = orderedPlacements
      .filter((p) => PLACEMENT_AVAILABLE[p.placementType])
      .map((p): CreateAdvertisementPayload => ({
        book: book.id,
        location: p.placementType,
        start_date: p.startDate,
        end_date: p.endDate,
      }));

    if (payloads.length === 0) {
      showError("Немає доступних позицій для публікації");
      return;
    }

    submitMutation.mutate({ items: payloads });
  };

  const handleAddToOrder = (placementType: PlacementType) => {
    const result = addToOrder(placementType);
    if (!result.success) {
      showError(result.message ?? "Неможливо додати в заказ");
    }
  };

  if (!slug) return null;

  return (
    <section className={styles.section} aria-labelledby="advertising-title">
      <header className={styles.header}>
        <h2 id="advertising-title" className={styles.title}>
          Реклама на сайті
        </h2>
        <div className={styles.titleDecor} aria-hidden>
          <span className={styles.titleDecorLine} />
          <span className={styles.titleDecorLine} />
        </div>
        <p className={styles.note}>
          * Увага, після натискання на кнопку &quot;Опублікувати&quot; вартість
          реклами автоматично списується з вашого балансу.
        </p>
      </header>

      <div className={styles.list}>
        {advertisingPlacements.map((config) => {
          const state = placements[config.placementType];
          const isAvailable = config.available;
          const minEndDate = state.startDate || minStartDate;

          return (
            <article
              key={config.placementType}
              className={styles.row}
              data-unavailable={!isAvailable || undefined}
            >
              <div className={styles.checkCol}>
                <label className={styles.checkboxWrap}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    aria-label={`Обрати ${config.title}`}
                    checked={state.includedInOrder}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleAddToOrder(config.placementType);
                      } else {
                        removeFromOrder(config.placementType);
                      }
                    }}
                    disabled={!isAvailable}
                  />
                  <span className={styles.checkboxBox} aria-hidden />
                </label>
              </div>

              <div className={styles.infoCol}>
                <h3 className={styles.rowTitle}>
                  {config.title}{" "}
                  <span>({config.pricePerDay} FanCoins/день)</span>
                  {!isAvailable && (
                    <span className={styles.unavailableBadge}> — Скоро</span>
                  )}
                </h3>
                <p className={styles.rowDescription}>{config.description}</p>
              </div>

              <div className={styles.controlsCol}>
                <div className={styles.dateRow}>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      value={state.startDate}
                      min={minStartDate}
                      onChange={(e) =>
                        updatePlacement(config.placementType, {
                          startDate: e.target.value,
                        })
                      }
                      disabled={!isAvailable}
                    />
                    <CalendarIcon />
                  </label>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      value={state.endDate}
                      min={minEndDate}
                      onChange={(e) =>
                        updatePlacement(config.placementType, {
                          endDate: e.target.value,
                        })
                      }
                      disabled={!isAvailable}
                    />
                    <CalendarIcon />
                  </label>
                </div>

                {config.filterType && (
                  <div className={styles.selectGroup}>
                    <span className={styles.selectHint}>
                      {config.filterPlaceholder}
                    </span>
                    <label className={styles.selectField}>
                      <span className={styles.selectLabel}>
                        {config.filterLabel}
                      </span>
                      <div className={styles.selectInputWrap}>
                        <select
                          value={state.targetId ?? ""}
                          onChange={(e) =>
                            updatePlacement(config.placementType, {
                              targetId: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          disabled={!isAvailable}
                          aria-label={config.filterPlaceholder}
                        >
                          <option value="" disabled hidden>
                            {config.filterPlaceholder}
                          </option>
                          {config.filterType === "genre" &&
                            meta.genres.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          {config.filterType === "tag" &&
                            meta.tags.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          {config.filterType === "fandom" &&
                            meta.fandoms.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                        </select>
                        <span className={styles.selectArrow} aria-hidden />
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className={styles.amountCol}>
                <label className={styles.amountField}>
                  <span className={styles.amountLabel}>Вартість:</span>
                  <div className={styles.amountInputRow}>
                    <input
                      type="text"
                      value={state.totalCost || ""}
                      readOnly
                      inputMode="numeric"
                      aria-label="Вартість"
                    />
                    <span className={styles.amountSuffix}>FanCoins</span>
                  </div>
                </label>
              </div>

              <div className={styles.actionCol}>
                <button
                  type="button"
                  className={styles.orderButton}
                  onClick={() => handleAddToOrder(config.placementType)}
                  disabled={
                    !isAvailable ||
                    state.includedInOrder ||
                    !state.startDate ||
                    !state.endDate
                  }
                >
                  <ButtonEmblem />
                  {state.includedInOrder ? "Додано" : "Додати в заказ"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <div className={styles.summary}>
          <p>Загальна вартість: {totalCost} FanCoins</p>
          <p>Ваш баланс: {balanceNum} FanCoins</p>
        </div>
        <div className={styles.publishWrap}>
          <button
            type="button"
            className={styles.publishButton}
            onClick={handlePublish}
            disabled={
              totalCost === 0 ||
              orderedPlacements.length === 0 ||
              submitMutation.isPending
            }
          >
            <ButtonEmblem />
            {submitMutation.isPending ? "Публікація…" : "Опублікувати"}
          </button>
        </div>
      </footer>
    </section>
  );
}
