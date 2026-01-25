import { fetchCsrfToken } from "./csrf";
import { refreshSessionSilent } from "./service";
import { markBootstrapped } from "./store";

export async function bootstrapAuth() {
  console.log("[bootstrap.ts] Начало bootstrap авторизации");
  try {
    console.log("[bootstrap.ts] Получение CSRF токена...");
    await fetchCsrfToken();
    // Попытка восстановить access по refresh cookie (тихий режим - не логируем 401 как error)
    console.log("[bootstrap.ts] Попытка восстановить access через refresh (тихий режим)...");
    await refreshSessionSilent();
    console.log("[bootstrap.ts] Bootstrap успешен, пользователь авторизован");
  } catch (error: any) {
    // Ок: пользователь гость или refresh истёк (7 дней) - это нормально, не логируем как error
    console.log("[bootstrap.ts] Bootstrap завершён (гость или refresh истёк):", error.response?.status === 401 ? "401 - гость" : error.message);
  } finally {
    markBootstrapped();
    console.log("[bootstrap.ts] Bootstrap завершён");
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
