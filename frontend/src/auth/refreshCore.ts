import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { authStore, clearAuth } from "./store";
import { setAccess } from "./token";
import { fetchCsrfToken } from "./csrf";

// Внутренние функции refresh/logout без mutex (используются в service.ts с mutex)
// Используют httpRaw чтобы избежать попадания в интерцепторы http.ts

export async function doRefresh(): Promise<string> {
  if (!authStore.csrfToken) {
    await fetchCsrfToken(); // Если вдруг не вызывали bootstrap
  }

  const { data } = await httpRaw.post(
    API.refresh,
    {},
    {
      withCredentials: true,
      headers: { "X-CSRFToken": authStore.csrfToken! },
    }
  );
  setAccess(data.access);
  return data.access as string;
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
