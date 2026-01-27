import { fetchCsrfToken } from "./csrf";
import { refreshSessionSilent } from "./service";
import { markBootstrapped } from "./store";
import { authSelfTest } from "./authSelfTest";

export async function bootstrapAuth() {
  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
    console.log("[bootstrap] start (AUTH_DEBUG)");
  }
  try {
    await fetchCsrfToken();
    await refreshSessionSilent();
  } catch (error: any) {
    // Ок: гость или refresh истёк
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
      console.log("[bootstrap] guest or refresh expired", error.response?.status === 401 ? "401" : error.message);
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
  // Тихий refresh для onFocus/onVisibility - не логируем ошибки как error
  const safeRefresh = () => refreshSessionSilent().catch(() => {});

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
