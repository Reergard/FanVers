import { http } from "../api/http";
import { API } from "../api/endpoints";

export interface FeePreview {
  amount_coins: string;
  fee_percent: string;
  fee_fixed_uah: string;
  fee_total_uah: string;
  amount_charged_uah: string;
}

export async function getFeePreview(amount: number): Promise<FeePreview> {
  const { data } = await http.get<FeePreview>(API.feePreview, {
    params: { amount },
  });
  return data;
}

export async function createCheckoutSession(amount: number): Promise<{ checkout_url: string }> {
  const { data } = await http.post<{ checkout_url: string }>(API.createCheckoutSession, { amount });
  return data;
}

export async function getPaymentSessionStatus(sessionId: string): Promise<{
  status: "pending" | "paid" | "expired" | "failed";
  amount_coins: string;
  paid_at: string | null;
}> {
  const { data } = await http.get(API.paymentSessionStatus, {
    params: { session_id: sessionId },
  });
  return data;
}

