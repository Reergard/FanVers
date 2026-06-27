/** Повний профіль користувача з GET /api/users/profile/ */
export type UserProfile = {
  username: string;
  email: string;
  about: string | null;
  role: "Читач" | "Перекладач" | "Літератор" | string;
  balance: string;
  commission?: string | number;

  /** URL аватара (великий) */
  profile_image_large?: string | null;
  /** URL аватара (малий) */
  profile_image_small?: string | null;
  image?: string | null;
  has_custom_image?: boolean;

  /** Статистика */
  total_characters?: number;
  total_chapters?: number;
  free_chapters?: number;
  average_rating?: number | string;
  total_author?: number;
  total_translations?: number;

  /** Налаштування сповіщень */
  notifications_enabled?: boolean;
  hide_adult_content?: boolean;
  private_messages_enabled?: boolean;
  age_confirmed?: boolean;
  comment_notifications?: boolean;
  translation_status_notifications?: boolean;
  chapter_subscription_notifications?: boolean;
  chapter_comment_notifications?: boolean;

  is_owner?: boolean;
  /** Право на виведення балансу; для чужого профілю з API приходить null */
  can_withdraw_balance?: boolean | null;
  /** Схвалений профіль виплат (KYC + метод); для чужого профілю — null */
  has_active_payout_profile?: boolean | null;
  /** Статус верифікації профілю виплат: null (немає), "draft", "pending", "approved", "rejected", "requires_more_info" */
  payout_profile_status?: string | null;
  /** Завжди true у поточній версії API (сумісність); самозміна ролі без глобального вимикача в settings */
  role_self_promotion_allowed?: boolean;
  /** Історія BalanceLog для власника профілю */
  balance_history?: BalanceHistoryItem[] | null;
};

/** Елемент історії транзакцій (відповідає BalanceLogSerializer) */
export type BalanceHistoryItem = {
  amount?: string | number;
  operation_type?: string;
  /** Опис операції (напр. «Реклама для книги "Title" на 2026-06-27 — 2026-07-05») */
  description?: string;
  /** @deprecated використовуйте operation_type */
  type?: string;
  status?: string;
  created_at?: string;
  date?: string;
};

/** Патч для оновлення налаштувань сповіщень */
export type NotificationSettingsPatch = Partial<{
  notifications_enabled: boolean;
  hide_adult_content: boolean;
  private_messages_enabled: boolean;
  age_confirmed: boolean;
  comment_notifications: boolean;
  translation_status_notifications: boolean;
  chapter_subscription_notifications: boolean;
  chapter_comment_notifications: boolean;
}>;

export type PayoutProfile = {
  id: number;
  country: string;
  full_name_legal: string;
  full_name_latin: string;
  address_line: string;
  city: string;
  postal_code: string;
  verification_status: string;
  payout_approved: boolean;
  can_request_payout?: boolean;
};

export type PayoutProfilePayload = Omit<
  PayoutProfile,
  "id" | "verification_status" | "payout_approved" | "can_request_payout"
>;

export type PayoutMethod = {
  id: number;
  method_type: string;
  /** Повний IBAN (GET /api/payouts/methods/, поле iban_full) */
  iban_full?: string;
  /** Застаріле / write-only на POST; інколи в кеші */
  iban?: string;
  iban_masked?: string;
  bic_swift_display?: string;
  recipient_full_name: string;
  currency: string;
  is_active: boolean;
  is_default: boolean;
  used_in_payouts?: boolean;
};

export type PayoutRequestItem = {
  id: number;
  is_urgent: boolean;
  coins_amount: string;
  commission_percent: string;
  commission_coins: string;
  coins_after_commission: string;
  payout_currency: string;
  exchange_rate: string;
  amount_gross: string;
  amount_net: string;
  status: string;
  created_at: string;
  deadline_at: string;
  completed_at?: string | null;
  invoice_number?: string | null;
};

export type PayoutRequestResponse = PayoutRequestItem & {
  new_balance: string;
};

export type PublicUserListItem = {
  id: number;
  username: string;
  nickname: string;
  role?: string;
  image?: string | null;
  books_count: number;
  comments_count: number;
  last_visit: string;
};
