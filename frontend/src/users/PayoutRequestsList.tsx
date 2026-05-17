import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../shared/Modal/Modal";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { getPayoutRequests, cancelPayoutRequest } from "./payoutService";
import { refreshAuthStatus } from "../auth/service";
import styles from "./Profile.module.css";
import type { PayoutRequestItem } from "./types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Очікує перевірки",
  awaiting_review: "На перевірці",
  approved: "Схвалено",
  in_batch: "У batch",
  processing: "Обробка у Wise",
  completed: "Виплачено",
  failed: "Відхилено",
  cancelled: "Скасовано",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f0ad4e",
  awaiting_review: "#f0ad4e",
  approved: "#5cb85c",
  in_batch: "#5bc0de",
  processing: "#5bc0de",
  completed: "#5cb85c",
  failed: "#d9534f",
  cancelled: "#999",
};

function canCancel(status: string): boolean {
  return status === "pending" || status === "awaiting_review";
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
      await refreshAuthStatus();
      showSuccess("Запит на виплату скасовано, кошти повернуто");
    },
    onError: (err: any) => {
      setCancellingId(null);
      showError(err?.response?.data?.error ?? "Помилка при скасуванні");
    },
  });

  const handleCancel = (id: number) => {
    setCancellingId(id);
    cancelMutation.mutate(id);
  };

  const requests: PayoutRequestItem[] = requestsQuery.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Мої запити на виплату">
      <div className={styles.transactionHistory}>
        {requestsQuery.isLoading ? (
          <p>Завантаження...</p>
        ) : requests.length === 0 ? (
          <p>Запитів на виплату ще немає</p>
        ) : (
          <ul>
            {requests.map((req) => (
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
                  {req.amount_net} грн
                  <br />
                  <span style={{ fontSize: "0.85em", opacity: 0.7 }}>
                    {new Date(req.created_at).toLocaleDateString("uk-UA")}{" "}
                    | Комісія: {req.commission_percent}%
                    {req.invoice_number ? ` | №${req.invoice_number}` : ""}
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
