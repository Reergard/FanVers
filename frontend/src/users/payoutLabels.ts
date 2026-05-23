/** Статуси запиту на виплату (PayoutRequest) */
export const PAYOUT_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "На перевірці",
  awaiting_review: "На перевірці",
  approved: "Схвалено",
  in_batch: "Схвалено",
  processing: "Відправлено у Wise",
  completed: "Виплачено",
  failed: "Відхилено",
  cancelled: "Скасовано",
};

/** Статуси KYC-профілю виплат (PayoutProfile) */
export const PAYOUT_PROFILE_STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  pending: "Очікує перевірки",
  approved: "Схвалено",
  rejected: "Відхилено",
  requires_more_info: "Потрібна додаткова інформація",
  cancelled: "Скасовано",
};

export const PAYOUT_PROFILE_STATUS_COLORS: Record<string, string> = {
  draft: "#999",
  pending: "#f0ad4e",
  approved: "#5cb85c",
  rejected: "#d9534f",
  requires_more_info: "#f0ad4e",
  cancelled: "#999",
};

/** Запит схвалено адміном або вже пішов у Wise (показуємо «раніше використовували») */
import type { PayoutRequestItem } from "./types";

/** Підпис комісії в списку запитів на виплату */
export function payoutRequestCommissionLabel(req: PayoutRequestItem): string {
  const pct = Number(req.commission_percent);
  const fee = Number(req.commission_coins);
  if (req.is_urgent || pct > 0 || fee > 0) {
    return `| Комісія ${req.commission_percent}% (−${req.commission_coins} FanCoins)`;
  }
  return "| Без комісії";
}

export const PAYOUT_PREVIOUSLY_USED_STATUSES = new Set([
  "approved",
  "in_batch",
  "processing",
  "completed",
  "failed",
]);

/** @deprecated використовуйте PAYOUT_PREVIOUSLY_USED_STATUSES */
export const PAYOUT_SENT_TO_WISE_STATUSES = new Set([
  "processing",
  "completed",
  "failed",
]);
