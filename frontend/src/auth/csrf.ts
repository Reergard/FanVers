import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";
import { setCsrf } from "./store";

export async function fetchCsrfToken() {
  // Используем httpRaw для консистентности с другими запросами
  const baseURL = import.meta.env.DEV 
    ? (import.meta.env.VITE_API_BASE_URL || "")
    : (import.meta.env.VITE_API_BASE_URL ?? "");
  const fullUrl = `${baseURL}${API.csrf}`;
  console.log("[csrf.ts] GET", fullUrl, "baseURL:", baseURL || "(используется прокси Vite)");
  
  try {
    const { data } = await httpRaw.get(API.csrf, { withCredentials: true });
    console.log("[csrf.ts] Response:", data);
    setCsrf(data.csrfToken);
    return data.csrfToken as string;
  } catch (error: any) {
    console.error("[csrf.ts] Error:", error.message, "URL:", fullUrl);
    throw error;
  }
}
