import { http } from "../api/http";
import { API } from "../api/endpoints";
import type {
  PayoutMethod,
  PayoutProfile,
  PayoutProfilePayload,
  PayoutRequestItem,
} from "./types";

export async function getPayoutProfile(): Promise<
  PayoutProfile | { exists: false }
> {
  const { data } = await http.get<PayoutProfile | { exists: false }>(
    API.payoutProfile
  );
  return data;
}

export async function createPayoutProfile(
  payload: PayoutProfilePayload
): Promise<PayoutProfile> {
  const { data } = await http.post<PayoutProfile>(API.payoutProfile, payload);
  return data;
}

export async function updatePayoutProfile(
  payload: Partial<PayoutProfilePayload>
): Promise<PayoutProfile> {
  const { data } = await http.put<PayoutProfile>(API.payoutProfile, payload);
  return data;
}

export async function submitPayoutProfile(
  coinsAmount: number,
  idempotencyKey: string,
  isUrgent = false,
): Promise<PayoutProfile> {
  const { data } = await http.post<PayoutProfile>(API.payoutProfileSubmit, {
    coins_amount: coinsAmount,
    idempotency_key: idempotencyKey,
    is_urgent: isUrgent,
  });
  return data;
}

export async function cancelPayoutProfile(): Promise<{ status: string }> {
  const { data } = await http.delete<{ status: string }>(API.payoutProfile);
  return data;
}

export async function getPayoutMethods(): Promise<PayoutMethod[]> {
  const { data } = await http.get<PayoutMethod[]>(API.payoutMethods);
  return data;
}

export async function getPayoutMethod(id: number): Promise<PayoutMethod> {
  const { data } = await http.get<PayoutMethod>(API.payoutMethod(id));
  return data;
}

export async function createPayoutMethod(
  payload: {
    iban: string;
    bic_swift?: string;
    recipient_full_name: string;
    currency: string;
    method_type?: string;
  }
): Promise<PayoutMethod> {
  const { data } = await http.post<PayoutMethod>(API.payoutMethods, payload);
  return data;
}

export async function getPayoutRequests(): Promise<PayoutRequestItem[]> {
  const { data } = await http.get<PayoutRequestItem[]>(API.payoutRequests);
  return data;
}

export async function cancelPayoutRequest(
  id: number
): Promise<{ status: string; new_balance: string }> {
  const { data } = await http.post<{ status: string; new_balance: string }>(
    API.cancelPayoutRequest(id)
  );
  return data;
}
