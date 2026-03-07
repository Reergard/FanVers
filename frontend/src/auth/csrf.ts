import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { setCsrf } from "./store";

export async function fetchCsrfToken() {
  // Та сама логіка baseURL, що й http.ts/httpRaw.ts, щоб проксі працював коректно
  const baseURL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
  const fullUrl = baseURL ? `${baseURL}${API.csrf}` : API.csrf;
  const AUTH_DEBUG = import.meta.env.VITE_AUTH_DEBUG === "true";
  if (AUTH_DEBUG) {
    console.log("[csrf.ts] GET", fullUrl, "baseURL:", baseURL || "(используется прокси Vite)");
  }
  
  try {
    const { data } = await httpRaw.get(API.csrf, { withCredentials: true });
    if (AUTH_DEBUG) {
      console.log("[csrf.ts] Response:", data);
    }
    setCsrf(data.csrfToken);
    return data.csrfToken as string;
  } catch (error: any) {
    if (AUTH_DEBUG) {
      console.error("[csrf.ts] Error:", error.message, "URL:", fullUrl);
    }
    throw error;
  }
}
