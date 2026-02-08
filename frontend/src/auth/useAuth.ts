import { useSyncExternalStore } from "react";
import { authStore, subscribeAuth, getStoreVersion } from "./store";

export type AuthState = {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  balance: string | null;
  authReady: boolean;
};

let cachedSnapshot: { csrfToken: string | null; bootstrapped: boolean; status: string; user: { userId: number | null; username: string | null; balance: string | null } } | null = null;
let cachedVersion = -1;

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
    authReady,
  };
}
