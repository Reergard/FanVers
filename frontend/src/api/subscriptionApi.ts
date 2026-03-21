/**
 * Subscription API — налаштування підписки, плани, покупки.
 */
import { http } from "./http";

const SUBSCRIPTION = "/api/subscription";

export type SubscriptionPlan = {
  id: number;
  discount_percent: string | number;
  discount_threshold: number;
  purchase_mode: "prepaid" | "instant";
  price_preview?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type BookSubscriptionSettings = {
  id: number | null;
  book: number;
  book_slug: string;
  is_enabled: boolean;
  plans: SubscriptionPlan[];
  created_at: string | null;
  updated_at: string | null;
};

export type UserBookSubscription = {
  id: number;
  book: number;
  book_slug: string;
  book_title: string;
  plan: number;
  plan_chapters_count: number;
  plan_price: string;
  purchased_chapters_count: number;
  remaining_chapters_count: number;
  price_paid: string;
  status: string;
  purchase_mode: string;
  created_at: string;
  expires_at: string | null;
};

export type SubscriptionSettingsResponse = BookSubscriptionSettings & {
  active_subscription: UserBookSubscription | null;
};

export const subscriptionKeys = {
  settings: (bookSlug: string) =>
    ["subscription", "settings", bookSlug] as const,
  userSubscriptions: () => ["subscription", "user"] as const,
};

export async function getSubscriptionSettings(
  bookSlug: string
): Promise<SubscriptionSettingsResponse> {
  const { data } = await http.get<SubscriptionSettingsResponse>(
    `${SUBSCRIPTION}/books/${encodeURIComponent(bookSlug)}/`
  );
  return data;
}

export type UpdateSubscriptionPayload = {
  is_enabled?: boolean;
  plans?: Array<{
    id?: number;
    discount_percent: number;
    discount_threshold: number;
    purchase_mode: "prepaid" | "instant";
    is_active?: boolean;
    sort_order?: number;
  }>;
};

export async function updateSubscriptionSettings(
  bookSlug: string,
  payload: UpdateSubscriptionPayload
): Promise<BookSubscriptionSettings> {
  const { data } = await http.put<BookSubscriptionSettings>(
    `${SUBSCRIPTION}/books/${encodeURIComponent(bookSlug)}/`,
    payload
  );
  return data;
}

function ensureIdempotencyKey(key?: string): string {
  if (key && key.trim()) return key;
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function purchasePlan(
  bookSlug: string,
  planId: number,
  idempotencyKey?: string
): Promise<{ message: string; subscription_id: number; remaining_chapters_count: number; price_paid: number }> {
  const { data } = await http.post(
    `${SUBSCRIPTION}/books/${encodeURIComponent(bookSlug)}/purchase-plan/`,
    { plan_id: planId, idempotency_key: ensureIdempotencyKey(idempotencyKey) }
  );
  return data as { message: string; subscription_id: number; remaining_chapters_count: number; price_paid: number };
}

export async function applyPlan(
  bookSlug: string,
  planId: number,
  chapterIds: number[],
  idempotencyKey?: string
): Promise<{ message: string; subscription_id: number; chapter_ids: number[]; price_paid: number }> {
  const { data } = await http.post(
    `${SUBSCRIPTION}/books/${encodeURIComponent(bookSlug)}/apply-plan/`,
    { plan_id: planId, chapter_ids: chapterIds, idempotency_key: ensureIdempotencyKey(idempotencyKey) }
  );
  return data as { message: string; subscription_id: number; chapter_ids: number[]; price_paid: number };
}

export type UserSubscriptionsResponse = {
  active: UserBookSubscription[];
  history: UserBookSubscription[];
};

export async function getUserSubscriptions(): Promise<UserSubscriptionsResponse> {
  const { data } = await http.get<UserSubscriptionsResponse>(
    `${SUBSCRIPTION}/user/subscriptions/`
  );
  return data;
}

export async function purchaseChapter(
  chapterId: number,
  idempotencyKey?: string,
  useBalance?: boolean
): Promise<{
  message: string;
  is_purchased: boolean;
  chapter_id: number;
  new_balance?: number;
  subscription_remaining?: number;
  price_paid?: number;
}> {
  const key = ensureIdempotencyKey(idempotencyKey);
  const payload: { idempotency_key: string; use_balance?: boolean } = { idempotency_key: key };
  if (useBalance === true) payload.use_balance = true;
  const { data } = await http.post(
    `/api/users/purchase-chapter/${chapterId}/`,
    payload
  );
  return data as {
    message: string;
    is_purchased: boolean;
    chapter_id: number;
    new_balance?: number;
    subscription_remaining?: number;
    price_paid?: number;
  };
}
