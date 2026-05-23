import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import {
  getPayoutProfile,
  getPayoutRequests,
  cancelPayoutRequest,
  cancelPayoutProfile,
} from "./payoutService";
import { refreshAuthStatus } from "../auth/service";
import { extractApiError } from "./payoutErrors";
import styles from "./Profile.module.css";
import type { PayoutRequestItem } from "./types";
import { profileQueryKey } from "../shared/queryKeys";

import {
  PAYOUT_PROFILE_STATUS_COLORS,
  PAYOUT_PROFILE_STATUS_LABELS,
  PAYOUT_REQUEST_STATUS_LABELS,
  payoutRequestCommissionLabel,
} from "./payoutLabels";

const STATUS_LABELS = PAYOUT_REQUEST_STATUS_LABELS;

const STATUS_COLORS: Record<string, string> = {
  pending: "#f0ad4e",
  awaiting_review: "#f0ad4e",
  approved: "#5cb85c",
  in_batch: "#5cb85c",
  processing: "#5bc0de",
  completed: "#5cb85c",
  failed: "#d9534f",
  cancelled: "#999",
};

const PROFILE_STATUS_LABELS = PAYOUT_PROFILE_STATUS_LABELS;
const PROFILE_STATUS_COLORS = PAYOUT_PROFILE_STATUS_COLORS;

function canCancel(status: string): boolean {
  return status === "pending" || status === "awaiting_review";
}

function canCancelProfile(status: string): boolean {
  return status === "pending" || status === "draft" || status === "requires_more_info" || status === "rejected";
}

type Props = {
  open: boolean;
  onClose: () => void;
  userId: number | null;
};

export function PayoutRequestsList({ open, onClose, userId }: Props) {
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancellingProfile, setCancellingProfile] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["payoutProfile", userId],
    queryFn: getPayoutProfile,
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const requestsQuery = useQuery({
    queryKey: ["payoutRequests", userId],
    queryFn: getPayoutRequests,
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelPayoutRequest(id),
    onSuccess: async () => {
      setCancellingId(null);
      queryClient.invalidateQueries({ queryKey: ["payoutRequests", userId] });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await refreshAuthStatus();
      showSuccess("Запит на виплату скасовано, кошти повернуто");
    },
    onError: (err: unknown) => {
      setCancellingId(null);
      showError(extractApiError(err, "Помилка при скасуванні"));
    },
  });

  const cancelProfileMutation = useMutation({
    mutationFn: cancelPayoutProfile,
    onSuccess: async () => {
      setCancellingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["payoutProfile", userId] });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await refreshAuthStatus();
      showSuccess("Заявку на виплати скасовано");
      onClose();
    },
    onError: (err: unknown) => {
      setCancellingProfile(false);
      showError(extractApiError(err, "Помилка при скасуванні заявки"));
    },
  });

  const handleCancel = (id: number) => {
    if (!window.confirm("Скасувати запит на виплату? Кошти буде повернуто на баланс.")) return;
    setCancellingId(id);
    cancelMutation.mutate(id);
  };

  const handleCancelProfile = () => {
    if (!window.confirm("Скасувати заявку на виплати? Кошти буде повернуто на баланс, заявку можна буде подати повторно.")) return;
    setCancellingProfile(true);
    cancelProfileMutation.mutate();
  };

  const requests: PayoutRequestItem[] = requestsQuery.data ?? [];
  const payoutProfile = profileQuery.data && "id" in profileQuery.data
    ? profileQuery.data
    : null;

  // Активні — тільки ті, де користувач чекає дії від нас (ще не відправлено)
  const ACTIVE_STATUSES = new Set(["pending", "awaiting_review", "approved", "in_batch"]);
  const activeRequests = requests.filter((r) => ACTIVE_STATUSES.has(r.status));
  const historyRequests = requests.filter((r) => !ACTIVE_STATUSES.has(r.status));

  // KYC-профіль — лише якщо ще немає запитів на виплату (не плутати «Схвалено» профілю зі статусом заявки)
  const hasAnyPayoutRequest = requests.length > 0;
  const showProfileBlock =
    payoutProfile &&
    !hasAnyPayoutRequest &&
    payoutProfile.verification_status !== "approved" &&
    payoutProfile.verification_status !== "cancelled";

  return (
    <Modal open={open} onClose={onClose} title="Запити на виплату">
      <div className={styles.transactionHistory}>
        {showProfileBlock ? (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: "12px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <strong>Заявка на виплати</strong>
              <br />
              <span style={{ fontSize: "0.85em", opacity: 0.7 }}>
                {payoutProfile.full_name_latin} · {payoutProfile.country}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  color: PROFILE_STATUS_COLORS[payoutProfile.verification_status] ?? "#ccc",
                  fontWeight: 600,
                  fontSize: "0.9em",
                  whiteSpace: "nowrap",
                }}
              >
                {PROFILE_STATUS_LABELS[payoutProfile.verification_status] ?? payoutProfile.verification_status}
              </span>
              {canCancelProfile(payoutProfile.verification_status) && (
                <button
                  type="button"
                  className={styles.btnRed}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.8em",
                    minWidth: "auto",
                  }}
                  disabled={cancellingProfile}
                  onClick={handleCancelProfile}
                >
                  {cancellingProfile ? "..." : "Скасувати"}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Активні запити (в обробці) — показуються окремим блоком зверху */}
        {!requestsQuery.isLoading && activeRequests.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            {activeRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: "10px 12px",
                  marginBottom: "6px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{req.coins_amount} FanCoins</strong>
                  {" → "}
                  {req.amount_net} {req.payout_currency}
                  {req.is_urgent && (
                    <span
                      style={{
                        marginLeft: "6px",
                        color: "#fff",
                        background: "#f0ad4e",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "0.75em",
                        fontWeight: 700,
                      }}
                    >
                      ⚡ Терміново
                    </span>
                  )}
                  <br />
                  <span style={{ fontSize: "0.85em", opacity: 0.7 }}>
                    {new Date(req.created_at).toLocaleDateString("uk-UA")}{" "}
                    {payoutRequestCommissionLabel(req)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      color: STATUS_COLORS[req.status] ?? "#ccc",
                      fontWeight: 600,
                      fontSize: "0.9em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                  {canCancel(req.status) && (
                    <button
                      type="button"
                      className={styles.btnRed}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.8em",
                        minWidth: "auto",
                      }}
                      disabled={cancellingId === req.id}
                      onClick={() => handleCancel(req.id)}
                    >
                      {cancellingId === req.id ? "..." : "Скасувати"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Історія виплат (завершені) */}
        {requestsQuery.isLoading ? (
          !profileQuery.isLoading && <p>Завантаження...</p>
        ) : historyRequests.length > 0 ? (
          <>
            <p style={{ fontSize: "0.85em", opacity: 0.7, margin: "0 0 8px" }}>
              Історія виплат:
            </p>
            <ul>
              {historyRequests.map((req) => (
                <li
                  key={req.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{req.coins_amount} FanCoins</strong>
                    {" → "}
                    {req.amount_net} {req.payout_currency}
                    {req.is_urgent && (
                      <span
                        style={{
                          marginLeft: "6px",
                          color: "#fff",
                          background: "#f0ad4e",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          fontSize: "0.75em",
                          fontWeight: 700,
                        }}
                      >
                        ⚡
                      </span>
                    )}
                    <br />
                    <span style={{ fontSize: "0.85em", opacity: 0.7 }}>
                      {new Date(req.created_at).toLocaleDateString("uk-UA")}{" "}
                      {payoutRequestCommissionLabel(req)}
                      {req.invoice_number ? ` | №${req.invoice_number}` : ""}
                    </span>
                  </div>
                  <span
                    style={{
                      color: STATUS_COLORS[req.status] ?? "#ccc",
                      fontWeight: 600,
                      fontSize: "0.9em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          !payoutProfile && activeRequests.length === 0 && (
            <p>Запитів на виплату ще немає</p>
          )
        )}
      </div>
    </Modal>
  );
}
