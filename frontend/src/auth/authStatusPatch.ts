import type { AuthUser } from "./store";

/** Тіло GET /api/users/auth-status/ (поля, які читаємо на фронті). */
export type AuthStatusPayload = {
  userId?: number | null;
  username?: string | null;
  balance?: string | null;
  /** «Читач» | «Перекладач» | «Літератор» з бекенду */
  role?: string | null;
  can_withdraw_balance?: boolean | null;
  has_active_payout_profile?: boolean | null;
  role_self_promotion_allowed?: boolean | null;
};

/**
 * Не використовувати Boolean(data?.can_withdraw_balance): при відсутньому полі в JSON
 * це дає false і затирає попереднє значення в store.
 * Оновлюємо canWithdrawBalance / roleSelfPromotionAllowed лише якщо в відповіді явно boolean.
 */
export function authStatusToStorePatch(
  data: AuthStatusPayload | null | undefined
): Partial<AuthUser> {
  if (data == null) {
    return {};
  }
  const patch: Partial<AuthUser> = {
    userId: data.userId ?? null,
    username: data.username ?? null,
    balance: data.balance ?? null,
  };
  if (data.role !== undefined) {
    patch.role = data.role ?? null;
  }
  if (typeof data.can_withdraw_balance === "boolean") {
    patch.canWithdrawBalance = data.can_withdraw_balance;
  }
  if (typeof data.has_active_payout_profile === "boolean") {
    patch.hasActivePayoutProfile = data.has_active_payout_profile;
  }
  if (typeof data.role_self_promotion_allowed === "boolean") {
    patch.roleSelfPromotionAllowed = data.role_self_promotion_allowed;
  }
  return patch;
}
