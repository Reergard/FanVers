import { useSyncExternalStore } from "react";
import { authStore, subscribeAuth } from "./store";

export type AuthState = {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  balance: string | null;
  authReady: boolean;
};

function getSnapshot() {
  return authStore;
}

/**
 * Подписка на единый auth store. Не вызывает authStatus() — данные поднимает bootstrap.
 */
export function useAuth(): AuthState {
  const s = useSyncExternalStore(subscribeAuth, getSnapshot, getSnapshot);

  const isAuthenticated = s.status === "authenticated";
  const authReady = s.status !== "unknown";

  return {
    isAuthenticated,
    userId: s.user.userId,
    username: s.user.username,
    balance: s.user.balance,
    authReady,
  };
}
