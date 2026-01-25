import { fetchCsrfToken } from "./csrf";
import { refreshSession } from "./service";
import { markBootstrapped } from "./store";

export async function bootstrapAuth() {
  try {
    await fetchCsrfToken();
    // Попытка восстановить access по refresh cookie
    await refreshSession();
  } catch {
    // Ок: пользователь гость или refresh истёк (7 дней)
  } finally {
    markBootstrapped();
  }
}

export function attachAuthAutoRefresh() {
  const safeRefresh = () => refreshSession().catch(() => {});

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
