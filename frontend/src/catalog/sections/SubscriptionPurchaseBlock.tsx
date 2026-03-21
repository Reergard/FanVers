import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useAuthModal } from "../../auth/AuthModalContext";
import { ActionButton } from "../../shared/ActionButton/ActionButton";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import {
  getSubscriptionSettings,
  purchasePlan,
  subscriptionKeys,
  type SubscriptionPlan,
  type SubscriptionSettingsResponse,
} from "../../api/subscriptionApi";
import styles from "../styles/BookDetail.module.css";
import purchaseStyles from "./SubscriptionPurchaseBlock.module.css";

export type SubscriptionPurchaseBlockProps = {
  bookSlug: string;
  onPurchaseSuccess?: () => void;
};

export function SubscriptionPurchaseBlock({
  bookSlug,
  onPurchaseSuccess,
}: SubscriptionPurchaseBlockProps) {
  const { isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();

  const { data: settings, isLoading } = useQuery({
    queryKey: subscriptionKeys.settings(bookSlug),
    queryFn: () => getSubscriptionSettings(bookSlug),
    enabled: !!bookSlug,
  });

  const purchaseMutation = useMutation({
    mutationFn: (planId: number) => purchasePlan(bookSlug, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.settings(bookSlug) });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.userSubscriptions() });
      showSuccess("Пакет успішно придбано");
      onPurchaseSuccess?.();
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : "Помилка покупки");
    },
  });

  const resp = settings as SubscriptionSettingsResponse | undefined;
  const activeSub = resp?.active_subscription;
  const plans = (resp?.plans ?? []).filter(
    (p) => p.is_active && p.purchase_mode === "prepaid"
  ) as SubscriptionPlan[];

  if (isLoading || !bookSlug) return null;
  if (!resp?.is_enabled || plans.length === 0) return null;

  return (
    <section className={purchaseStyles.purchaseBlock} aria-label="Абонимент на книгу">
      <div className={styles.headingWithLine}>
        <h3 className={purchaseStyles.title}>Абонимент</h3>
        <span className={styles.headingLine} aria-hidden />
      </div>

      <div className={purchaseStyles.card}>
        {activeSub ? (
          <div className={purchaseStyles.activeInfo}>
            <span className={purchaseStyles.activeLabel}>У вас є активний пакет:</span>
            <span className={purchaseStyles.activeValue}>
              {activeSub.remaining_chapters_count} / {activeSub.plan_chapters_count} розділів
            </span>
            <span className={purchaseStyles.activeHint}>
              *Для використання, натисніть Купити у потрібного розділа
            </span>
          </div>
        ) : !isAuthenticated ? (
          <div className={purchaseStyles.planList}>
            {plans.map((p) => (
              <div key={p.id} className={purchaseStyles.planItem}>
                <span className={purchaseStyles.planDetails}>
                  Знижка {p.discount_percent}% від {p.discount_threshold} розд. — {p.price_preview ?? "—"} FanCoins
                </span>
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={() => openLoginModal(location.pathname)}
                  ariaLabel={`Купити пакет (потрібен вхід)`}
                >
                  Купити
                </ActionButton>
              </div>
            ))}
          </div>
        ) : (
          <div className={purchaseStyles.planList}>
            {plans.map((p) => (
              <div key={p.id} className={purchaseStyles.planItem}>
                <span className={purchaseStyles.planDetails}>
                  Знижка {p.discount_percent}% від {p.discount_threshold} розд. — {p.price_preview ?? "—"} FanCoins
                </span>
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={() => purchaseMutation.mutate(p.id)}
                  loading={purchaseMutation.isPending}
                  disabled={purchaseMutation.isPending}
                  ariaLabel={`Купити пакет за ${p.price_preview ?? "—"} FanCoins`}
                >
                  Купити
                </ActionButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
