import { useSyncExternalStore } from "react";
import { authStore, subscribeAuth, getStoreVersion } from "./store";

export type AuthState = {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  balance: string | null;
  role: string | null;
  canWithdrawBalance: boolean | null;
  roleSelfPromotionAllowed: boolean | null;
  authReady: boolean;
};

let cachedSnapshot: {
  csrfToken: string | null;
  bootstrapped: boolean;
  status: string;
  user: {
    userId: number | null;
    username: string | null;
    balance: string | null;
    role: string | null;
    canWithdrawBalance: boolean | null;
    roleSelfPromotionAllowed: boolean | null;
  };
} | null = null;
let cachedVersion = -1;

export function resetAuthCache() {
  cachedSnapshot = null;
  cachedVersion = -1;
}

function getSnapshot() {
  const v = getStoreVersion();
  if (cachedSnapshot && cachedVersion === v) return cachedSnapshot;
  cachedVersion = v;
  cachedSnapshot = {
    ...authStore,
    user: { ...authStore.user },
  };
  return cachedSnapshot;
}

/**
 * Подписка на единый auth store. Не вызывает authStatus() — данные поднимает bootstrap.
 */
export function useAuth(): AuthState {
  const s = useSyncExternalStore(subscribeAuth, getSnapshot, getSnapshot);

  const isAuthenticated = s.status === "authenticated";
  const authReady = s.bootstrapped && s.status !== "unknown";

  return {
    isAuthenticated,
    userId: s.user.userId,
    username: s.user.username,
    balance: s.user.balance,
    role: s.user.role,
    canWithdrawBalance: s.user.canWithdrawBalance,
    roleSelfPromotionAllowed: s.user.roleSelfPromotionAllowed,
    authReady,
  };
}
