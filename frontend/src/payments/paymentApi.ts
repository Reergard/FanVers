import { http } from "../api/http";
import { API } from "../api/endpoints";

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

