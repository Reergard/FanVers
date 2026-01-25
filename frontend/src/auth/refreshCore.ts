import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { authStore, clearAuth } from "./store";
import { setAccess } from "./token";
import { fetchCsrfToken } from "./csrf";

// Внутренние функции refresh/logout без mutex (используются в service.ts с mutex)
// Используют httpRaw чтобы избежать попадания в интерцепторы http.ts

export async function doRefresh(silent: boolean = false): Promise<string> {
  if (!authStore.csrfToken) {
    if (!silent) {
      console.log("[refreshCore.ts] CSRF токен отсутствует, получаем...");
    }
    await fetchCsrfToken(); // Если вдруг не вызывали bootstrap
  }

  const baseURL = import.meta.env.DEV 
    ? (import.meta.env.VITE_API_BASE_URL || "")
    : (import.meta.env.VITE_API_BASE_URL ?? "");
  const fullUrl = `${baseURL}${API.refresh}`;
  
  if (!silent) {
    console.log("[refreshCore.ts] POST", fullUrl, "baseURL:", baseURL || "(используется прокси Vite)", "CSRF:", authStore.csrfToken ? "есть" : "нет");
    
    // ВАЖНО: httponly cookie не видна через document.cookie, но это нормально
    // Браузер автоматически отправит её в запросах с withCredentials: true
    const refreshCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("refresh_token="));
    console.log("[refreshCore.ts] Refresh cookie в браузере (через document.cookie):", refreshCookie ? "есть" : "отсутствует (нормально для httponly)");
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
    if (!silent) {
      console.log("[refreshCore.ts] Refresh успешен, получен access токен");
    }
    setAccess(data.access);
    return data.access as string;
  } catch (error: any) {
    // В тихом режиме логируем как info, не как error
    if (silent) {
      console.log("[refreshCore.ts] Refresh failed (silent):", error.response?.status === 401 ? "401 - гость или refresh истёк" : error.message);
    } else {
      console.error("[refreshCore.ts] Refresh error:", error.message, "URL:", fullUrl, "Status:", error.response?.status);
    }
    throw error;
  }
}

export async function doLogout() {
  try {
    if (!authStore.csrfToken) {
      await fetchCsrfToken();
    }
    await httpRaw.post(
      API.logout,
      {},
      {
        withCredentials: true,
        headers: { "X-CSRFToken": authStore.csrfToken! },
      }
    );
  } finally {
    clearAuth();
  }
}
