import { setAccess } from "./token";

export type AuthStatus = "unknown" | "anonymous" | "authenticated";

export type AuthUser = {
  userId: number | null;
  username: string | null;
  balance: string | null;
  /** Роль профілю з GET auth-status («Читач» | «Перекладач» | «Літератор»); null — ще не в відповіді */
  role: string | null;
  /** Право на виведення балансу (з auth-status); null — ще не завантажено */
  canWithdrawBalance: boolean | null;
  /** Схвалений профіль виплат; null — ще не завантажено */
  hasActivePayoutProfile: boolean | null;
  /** Чи дозволена самостійна зміна ролі через API (зазвичай false у проді) */
  roleSelfPromotionAllowed: boolean | null;
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
  user: {
    userId: null,
    username: null,
    balance: null,
    role: null,
    canWithdrawBalance: null,
    hasActivePayoutProfile: null,
    roleSelfPromotionAllowed: null,
  },
};

let storeVersion = 0;
export function getStoreVersion() {
  return storeVersion;
}

const listeners = new Set<() => void>();

function emit() {
  storeVersion++;
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
  authStore.user = {
    userId: null,
    username: null,
    balance: null,
    role: null,
    canWithdrawBalance: null,
    hasActivePayoutProfile: null,
    roleSelfPromotionAllowed: null,
  };
  emit();
}

export function setAuthAuthenticated(user: Partial<AuthUser>) {
  authStore.status = "authenticated";
  const prev = authStore.user;
  authStore.user = {
    userId: user.userId ?? prev.userId ?? null,
    username: user.username ?? prev.username ?? null,
    balance: user.balance !== undefined ? user.balance : prev.balance,
    role: user.role !== undefined ? user.role : prev.role,
    canWithdrawBalance:
      user.canWithdrawBalance !== undefined ? user.canWithdrawBalance : prev.canWithdrawBalance,
    hasActivePayoutProfile:
      user.hasActivePayoutProfile !== undefined
        ? user.hasActivePayoutProfile
        : prev.hasActivePayoutProfile,
    roleSelfPromotionAllowed:
      user.roleSelfPromotionAllowed !== undefined
        ? user.roleSelfPromotionAllowed
        : prev.roleSelfPromotionAllowed,
  };
  emit();
}

export function clearAuth() {
  setAccess(null);
  authStore.csrfToken = null;
  authStore.status = "anonymous";
  authStore.user = {
    userId: null,
    username: null,
    balance: null,
    role: null,
    canWithdrawBalance: null,
    hasActivePayoutProfile: null,
    roleSelfPromotionAllowed: null,
  };
  emit();
}
