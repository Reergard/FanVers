import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { refreshAuthStatus } from "../../auth/service";
import { FilterDropdown } from "../../navigation/FilterDropdown";
import { DatePickerField } from "../../shared/DatePickerField/DatePickerField";
import { useBookBySlug } from "../hooks/useBookBySlug";
import { useBookFormMeta } from "../hooks/useBookFormMeta";
import "../../search/search.css";
import {
  submitAdvertisingOrder,
  advertisingKeys,
  type CreateAdvertisementPayload,
} from "../../api/advertisingApi";
import { extractUserMessage } from "../../shared/utils/errorUtils";
import type { AdvertisingSlotKey } from "./advertising.types";
import {
  advertisingPlacements,
  slotKeyToApiFields,
  type AdvertisingPlacementConfig,
} from "./advertising.data";
import { SLOT_AVAILABLE } from "./advertising.constants";
import { useAdvertisingOrder } from "./useAdvertisingOrder";
import styles from "./Advertising.module.css";

function parseBalance(value: string | number | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Placeholder: замінити на SVG emblem коли буде готовий */
function ButtonEmblem() {
  return <span className={styles.orderButtonIcon} aria-hidden />;
}

function getTargetDisplayLabel(
  config: AdvertisingPlacementConfig,
  targetId: number | null,
  meta: ReturnType<typeof useBookFormMeta>
): string {
  if (!config.filterType || targetId == null) {
    return config.filterPlaceholder ?? "";
  }
  if (config.filterType === "genre") {
    return (
      meta.genres.find((g) => g.id === targetId)?.name ??
      config.filterPlaceholder ??
      ""
    );
  }
  if (config.filterType === "tag") {
    return (
      meta.tags.find((t) => t.id === targetId)?.name ??
      config.filterPlaceholder ??
      ""
    );
  }
  if (config.filterType === "fandom") {
    return (
      meta.fandoms.find((f) => f.id === targetId)?.name ??
      config.filterPlaceholder ??
      ""
    );
  }
  return config.filterPlaceholder ?? "";
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

  const [targetPicker, setTargetPicker] = useState<{
    slotKey: AdvertisingSlotKey;
    anchor: HTMLElement;
  } | null>(null);

  const pickerConfig = targetPicker
    ? advertisingPlacements.find((c) => c.slotKey === targetPicker.slotKey)
    : null;

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
      queryClient.invalidateQueries({ queryKey: advertisingKeys.all });
      showSuccess("Реклама успішно створена");
      navigate(`/books/${slug}`);
    },
    onError: async (err: unknown) => {
      showError(extractUserMessage(err, "Помилка при створенні реклами"));
      await refreshAuthStatus();
      queryClient.invalidateQueries({ queryKey: advertisingKeys.userAds() });
      queryClient.invalidateQueries({ queryKey: advertisingKeys.all });
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
      .filter((p) => SLOT_AVAILABLE[p.slotKey])
      .map((p): CreateAdvertisementPayload => {
        const { location, target_kind } = slotKeyToApiFields(p.slotKey);
        const target_id =
          target_kind === "none" ? null : p.targetId;
        return {
          book: book.id,
          location,
          target_kind,
          target_id,
          start_date: p.startDate,
          end_date: p.endDate,
        };
      });

    if (payloads.length === 0) {
      showError("Немає доступних позицій для публікації");
      return;
    }

    submitMutation.mutate({ items: payloads });
  };

  const handleAddToOrder = (slotKey: AdvertisingSlotKey) => {
    const result = addToOrder(slotKey);
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
          const state = placements[config.slotKey];
          const isAvailable = config.available;
          const minEndDate = state.startDate || minStartDate;

          return (
            <article
              key={config.slotKey}
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
                        handleAddToOrder(config.slotKey);
                      } else {
                        removeFromOrder(config.slotKey);
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
                  <DatePickerField
                    value={state.startDate}
                    min={minStartDate}
                    onChange={(iso) =>
                      updatePlacement(config.slotKey, { startDate: iso })
                    }
                    disabled={!isAvailable}
                    ariaLabel={`Дата початку — ${config.title}`}
                  />
                  <DatePickerField
                    key={`${config.slotKey}-end-${state.startDate}`}
                    value={state.endDate}
                    min={minEndDate}
                    onChange={(iso) =>
                      updatePlacement(config.slotKey, { endDate: iso })
                    }
                    disabled={!isAvailable}
                    ariaLabel={`Дата закінчення — ${config.title}`}
                  />
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
                        <button
                          type="button"
                          className={`filters-item ${styles.targetFilterButton}`}
                          disabled={!isAvailable}
                          aria-expanded={
                            targetPicker?.slotKey === config.slotKey
                          }
                          aria-haspopup="dialog"
                          aria-label={config.filterPlaceholder}
                          onClick={(e) =>
                            setTargetPicker({
                              slotKey: config.slotKey,
                              anchor: e.currentTarget,
                            })
                          }
                        >
                          <span className={styles.targetFilterLabel}>
                            {getTargetDisplayLabel(
                              config,
                              state.targetId,
                              meta
                            )}
                          </span>
                          <span className="filters-chevron" aria-hidden>
                            ›
                          </span>
                        </button>
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
                  onClick={() => handleAddToOrder(config.slotKey)}
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

      <FilterDropdown
        open={targetPicker != null && !!pickerConfig?.filterType}
        anchorEl={targetPicker?.anchor ?? null}
        onClose={() => setTargetPicker(null)}
        align="end"
        className="search-filter-dropdown"
      >
        {pickerConfig?.filterType && targetPicker && (
          <div className="search-filter-dropdown-inner">
            <div className="search-filter-dropdown-header">
              <span className="search-filter-dropdown-title">
                {pickerConfig.filterLabel ?? ""}
              </span>
              <button
                type="button"
                className="search-filter-close"
                onClick={() => setTargetPicker(null)}
              >
                Закрити
              </button>
            </div>
            <div className="search-filter-options-wrap">
              {meta.isLoading ? (
                <div className="search-filter-empty">Завантаження…</div>
              ) : pickerConfig.filterType === "tag" &&
                meta.tagGroups.length > 0 ? (
                <div className="search-tag-groups">
                  {meta.tagGroups.map((group) => (
                    <div key={group.name} className="search-tag-group">
                      <div className="search-tag-group-header">
                        <span className="search-tag-group-title">
                          {group.name}
                        </span>
                        <span
                          className="search-tag-group-line"
                          aria-hidden
                        />
                      </div>
                      <div className="search-filter-options-grid">
                        {group.tags.map((item) => {
                          const selected =
                            placements[targetPicker.slotKey].targetId ===
                            item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={
                                selected
                                  ? "search-filter-chip search-filter-chip-selected"
                                  : "search-filter-chip"
                              }
                              onClick={() => {
                                updatePlacement(targetPicker.slotKey, {
                                  targetId: item.id,
                                });
                                setTargetPicker(null);
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
              ) : pickerConfig.filterType === "genre" &&
                meta.genres.length === 0 ? (
                <div className="search-filter-empty">
                  Немає даних для цього фільтра.
                </div>
              ) : pickerConfig.filterType === "tag" &&
                meta.tags.length === 0 ? (
                <div className="search-filter-empty">
                  Немає даних для цього фільтра.
                </div>
              ) : pickerConfig.filterType === "fandom" &&
                meta.fandoms.length === 0 ? (
                <div className="search-filter-empty">
                  Немає даних для цього фільтра.
                </div>
              ) : pickerConfig.filterType === "tag" ? (
                <div className="search-filter-options-grid">
                  {meta.tags.map((item) => {
                    const selected =
                      placements[targetPicker.slotKey].targetId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          selected
                            ? "search-filter-chip search-filter-chip-selected"
                            : "search-filter-chip"
                        }
                        onClick={() => {
                          updatePlacement(targetPicker.slotKey, {
                            targetId: item.id,
                          });
                          setTargetPicker(null);
                        }}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="search-filter-options-grid">
                  {(pickerConfig.filterType === "genre"
                    ? meta.genres
                    : meta.fandoms
                  ).map((item) => {
                    const selected =
                      placements[targetPicker.slotKey].targetId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          selected
                            ? "search-filter-chip search-filter-chip-selected"
                            : "search-filter-chip"
                        }
                        onClick={() => {
                          updatePlacement(targetPicker.slotKey, {
                            targetId: item.id,
                          });
                          setTargetPicker(null);
                        }}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </FilterDropdown>

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
