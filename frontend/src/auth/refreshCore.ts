import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { authStore, clearAuth } from "./store";
import { setAccess } from "./token";
import { fetchCsrfToken } from "./csrf";
import { authLog } from "./authLogger";
import { runSingleFlight } from "./refreshMutex";
import { resetAuthCache } from "./useAuth";

// Внутренние функции refresh/logout без mutex (используются в service.ts с mutex)
// Используют httpRaw чтобы избежать попадания в интерцепторы http.ts
// HttpOnly cookie в JS не видна — не проверяем document.cookie

export async function doRefresh(): Promise<string> {
  if (!authStore.csrfToken) {
    authLog("REFRESH_START", { reason: "csrf_missing" });
    await fetchCsrfToken();
  } else {
    authLog("REFRESH_START");
  }

  try {
    const { data } = await httpRaw.post(
      API.refresh,
      {},
      {
        withCredentials: true,
        headers: { "X-CSRFToken": authStore.csrfToken! },
      }
    );
    setAccess(data.access);
    authLog("REFRESH_OK");
    return data.access as string;
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 401) authLog("REFRESH_401");
    if (status !== 401 && import.meta.env.DEV) {
      console.error("[refreshCore] refresh error", error.message, "status:", status);
    }
    throw error;
  }
}

/** Форсированный refresh без cooldown — для 401-interceptor. Всегда реальный refresh. */
export function refreshSessionForce() {
  return runSingleFlight(() => doRefresh(), { force: true });
}

export async function doLogout() {
  try {
    if (!authStore.csrfToken) await fetchCsrfToken();
    await httpRaw.post(API.logout, {}, {
      withCredentials: true,
      headers: { "X-CSRFToken": authStore.csrfToken! },
    });
    authLog("LOGOUT_OK");
  } finally {
    clearAuth();
    resetAuthCache();
  }
}
