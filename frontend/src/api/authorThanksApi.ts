import { http } from "./http";
import { API } from "./endpoints";

export type SendAuthorThanksPayload = {
  book_id: number;
  amount: string;
  idempotency_key: string;
  message?: string;
};

export type SendAuthorThanksResponse = {
  message: string;
  new_balance: number;
  thanks_id: number;
  amount: number;
  duplicate?: boolean;
};

export async function sendAuthorThanks(
  payload: SendAuthorThanksPayload
): Promise<SendAuthorThanksResponse> {
  const { data } = await http.post<SendAuthorThanksResponse>(API.authorThanks, payload);
  return data;
}
