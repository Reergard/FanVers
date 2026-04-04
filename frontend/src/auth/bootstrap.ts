import { fetchCsrfToken } from "./csrf";
import { refreshSessionSilent, authStatus } from "./service";
import { markBootstrapped, setAuthAnonymous, setAuthAuthenticated, clearAuth } from "./store";
import { getAccess } from "./token";
import { authSelfTest } from "./authSelfTest";

export async function bootstrapAuth() {
  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
    console.log("[bootstrap] start (AUTH_DEBUG)");
  }
  try {
    await fetchCsrfToken();
    try {
      await refreshSessionSilent({ fromBootstrap: true });
    } catch (error: any) {
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
        console.log(
          "[bootstrap] guest or refresh expired",
          error.response?.status === 401 ? "401" : error.message
        );
      }
    }

    const token = getAccess();
    if (token) {
      try {
        const data = await authStatus();
        setAuthAuthenticated({
          userId: data?.userId ?? null,
          username: data?.username ?? null,
          balance: data?.balance ?? null,
          canWithdrawBalance: Boolean(data?.can_withdraw_balance),
          roleSelfPromotionAllowed: Boolean(data?.role_self_promotion_allowed),
        });
      } catch (err: any) {
        // Только 401 = невалидный токен → clearAuth. Сетевые/5xx — оставляем залогиненным.
        if (err?.response?.status === 401) {
          clearAuth();
        } else {
          setAuthAuthenticated({
            userId: null,
            username: null,
            balance: null,
            canWithdrawBalance: null,
            roleSelfPromotionAllowed: null,
          });
        }
      }
    } else {
      setAuthAnonymous();
    }
  } catch (error: any) {
    // Не перезаписываем authenticated, если токен уже есть (StrictMode: второй run мог упасть, первый — успел)
    if (!getAccess()) {
      setAuthAnonymous();
    }
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
      console.log("[bootstrap] error", error.message);
    }
  } finally {
    markBootstrapped();
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_SELFTEST === "true") {
      const { ok, steps } = await authSelfTest();
      console.log("[bootstrap] authSelfTest", ok ? "PASS" : "FAIL", steps);
    }
  }
}

export function attachAuthAutoRefresh() {
  // Если access нет (после сна/выгрузки) — пробуем refresh, как при bootstrap
  const safeRefresh = () =>
    refreshSessionSilent({ fromBootstrap: getAccess() == null }).catch(() => {});

  const onFocus = () => safeRefresh();
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      safeRefresh();
    }
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
