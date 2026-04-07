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
  /** Завжди true у поточній версії API (сумісність); самозміна ролі без глобального вимикача в settings */
  role_self_promotion_allowed?: boolean;
  /** Історія BalanceLog для власника профілю */
  balance_history?: BalanceHistoryItem[] | null;
};

/** Елемент історії транзакцій (відповідає BalanceLogSerializer) */
export type BalanceHistoryItem = {
  amount?: string | number;
  operation_type?: string;
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
