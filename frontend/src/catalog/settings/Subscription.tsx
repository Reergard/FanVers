import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import {
  getSubscriptionSettings,
  updateSubscriptionSettings,
  subscriptionKeys,
  type SubscriptionPlan,
  type SubscriptionSettingsResponse,
} from "../../api/subscriptionApi";
import styles from "./Subscription.module.css";

type SubscriptionItem = {
  id?: number;
  discountPercent: string;
  discountThreshold: string;
  purchaseMode: "prepaid" | "instant";
  is_active: boolean;
};

function plansToItems(plans: SubscriptionPlan[]): SubscriptionItem[] {
  return plans.map((p) => ({
    id: p.id,
    discountPercent: String(p.discount_percent ?? "0"),
    discountThreshold: String(p.discount_threshold ?? 10),
    purchaseMode: (p.purchase_mode === "instant" ? "instant" : "prepaid") as "prepaid" | "instant",
    is_active: p.is_active,
  }));
}

export default function Subscription() {
  const { slug = "" } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();

  const { data: settings, isLoading } = useQuery({
    queryKey: subscriptionKeys.settings(slug),
    queryFn: () => getSubscriptionSettings(slug),
    enabled: !!slug,
  });

  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);

  useEffect(() => {
    if (settings) {
      setSubscriptions(
        settings.plans?.length
          ? plansToItems(settings.plans)
          : [{ discountPercent: "10", discountThreshold: "10", purchaseMode: "prepaid", is_active: true }]
      );
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSubscriptionSettings>[1]) =>
      updateSubscriptionSettings(slug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.settings(slug) });
      showSuccess("Налаштування підписки збережено");
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : "Помилка збереження");
    },
  });

  const handleSubscriptionChange = (
    index: number,
    field: keyof SubscriptionItem,
    value: string | boolean
  ) => {
    setSubscriptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddPlan = () => {
    setSubscriptions((prev) => [
      ...prev,
      { discountPercent: "0", discountThreshold: "10", purchaseMode: "prepaid" as const, is_active: true },
    ]);
  };

  const handleRemovePlan = (index: number) => {
    setSubscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const plans = subscriptions
      .filter((s) => s.discountThreshold && parseInt(s.discountThreshold, 10) > 0)
      .map((s, i) => ({
        id: s.id,
        discount_percent: Number(s.discountPercent) || 0,
        discount_threshold: parseInt(s.discountThreshold, 10) || 10,
        purchase_mode: s.purchaseMode,
        is_active: s.is_active,
        sort_order: i,
      }))
      .filter((p) => p.discount_threshold > 0);

    if (plans.filter((p) => p.is_active).length > 2) {
      showError("Максимум 2 активних плани");
      return;
    }
    const activePlans = plans.filter((p) => p.is_active);
    if (activePlans.some((p) => (p.discount_percent ?? 0) <= 0)) {
      showError("План без знижки не має сенсу. Вкажіть знижку > 0%.");
      return;
    }

    updateMutation.mutate({
      is_enabled: plans.some((p) => p.is_active),
      plans,
    });
  };

  if (!slug) return null;

  if (isLoading) {
    return (
      <section className={styles.section} aria-label="Налаштування підписки">
        <p>Завантаження…</p>
      </section>
    );
  }

  const activeSub = (settings as SubscriptionSettingsResponse | undefined)?.active_subscription;

  return (
    <section className={styles.section} aria-label="Налаштування підписки">
      <div className={styles.block}>
        <h4 className={styles.blockTitle}>Абонементи</h4>
        <p className={styles.blockDesc}>
          Створіть плани зі знижкою: вкажіть відсоток знижки та поріг (від скільки розділів вона діє).
          Для кожного плану оберіть один режим: Пакет (prepaid) або Миттєва покупка обраних.
        </p>
        <div className={styles.table} role="table" aria-label="Плани підписки">
          {subscriptions.map((sub, index) => (
            <div key={sub.id ?? index} className={styles.row} role="row">
              <span className={styles.rowLabel} role="cell">
                Абонемент {index + 1}
              </span>
              <div className={styles.rowInputs} role="cell">
                <div className={styles.subscriptionCluster}>
                  <label className={`${styles.inputWrap} ${styles.subscriptionInput}`}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sub.discountPercent}
                      onChange={(e) =>
                        handleSubscriptionChange(index, "discountPercent", e.target.value)
                      }
                      aria-label={`Знижка %`}
                    />
                  </label>
                  <span className={styles.subscriptionLabel}>% знижки</span>
                  <label className={`${styles.inputWrap} ${styles.subscriptionInput}`}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sub.discountThreshold}
                      onChange={(e) =>
                        handleSubscriptionChange(index, "discountThreshold", e.target.value)
                      }
                      aria-label={`Поріг (від N розділів)`}
                    />
                  </label>
                  <span className={styles.subscriptionLabel}>розділів</span>
                  <div className={styles.modeRadio}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name={`planMode-${index}`}
                        checked={sub.purchaseMode === "prepaid"}
                        onChange={() =>
                          handleSubscriptionChange(index, "purchaseMode", "prepaid")
                        }
                      />
                      Пакет (prepaid)
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name={`planMode-${index}`}
                        checked={sub.purchaseMode === "instant"}
                        onChange={() =>
                          handleSubscriptionChange(index, "purchaseMode", "instant")
                        }
                      />
                      Миттєва покупка обраних
                    </label>
                  </div>
                  <label className={styles.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={sub.is_active}
                      onChange={(e) =>
                        handleSubscriptionChange(index, "is_active", e.target.checked)
                      }
                      aria-label={`Абонемент ${index + 1} — активовано`}
                    />
                    <span className={styles.subscriptionLabel}>Активовано</span>
                  </label>
                  {subscriptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlan(index)}
                      aria-label={`Видалити абонемент ${index + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={handleAddPlan} aria-label="Додати план">
          + Додати план
        </button>
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          aria-label="Зберегти налаштування підписки"
          disabled={updateMutation.isPending}
        >
          <svg
            className={styles.saveIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l3 3 5-6" />
          </svg>
          {updateMutation.isPending ? "Збереження…" : "Зберегти"}
        </button>
      </div>

      {activeSub && (
        <div className={styles.activePack} role="status">
          <strong>Активний пакет:</strong> {activeSub.remaining_chapters_count} /{" "}
          {activeSub.plan_chapters_count} розділів залишилось
        </div>
      )}
    </section>
  );
}
