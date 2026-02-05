import { setAccess } from "./token";

export type AuthStatus = "unknown" | "anonymous" | "authenticated";

export type AuthUser = {
  userId: number | null;
  username: string | null;
  balance: string | null;
};

export type AuthStore = {
  csrfToken: string | null;
  bootstrapped: boolean;
  status: AuthStatus;
  user: AuthUser;
};

export const authStore: AuthStore = {
  csrfToken: null,
  bootstrapped: false,
  status: "unknown",
  user: { userId: null, username: null, balance: null },
};

const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

export function subscribeAuth(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setCsrf(token: string | null) {
  authStore.csrfToken = token;
  emit();
}

export function markBootstrapped() {
  authStore.bootstrapped = true;
  emit();
}

export function setAuthAnonymous() {
  authStore.status = "anonymous";
  authStore.user = { userId: null, username: null, balance: null };
  emit();
}

export function setAuthAuthenticated(user: Partial<AuthUser>) {
  authStore.status = "authenticated";
  authStore.user = {
    userId: user.userId ?? authStore.user.userId ?? null,
    username: user.username ?? authStore.user.username ?? null,
    balance: user.balance ?? authStore.user.balance ?? null,
  };
  emit();
}

export function clearAuth() {
  setAccess(null);
  authStore.csrfToken = null;
  authStore.status = "anonymous";
  authStore.user = { userId: null, username: null, balance: null };
  emit();
}
