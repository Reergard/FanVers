import axios, { AxiosError } from "axios";
import { getAccess } from "../auth/token";
import { API } from "./endpoints";
import { refreshSessionForce, doLogout } from "../auth/refreshCore";
import { authLog } from "../auth/authLogger";

// 401 → всегда реальный refresh через refreshSessionForce (force: true, без cooldown).
// Logout — через refreshCore (httpRaw, без интерцепторов).

// В dev — жёстко прокси (baseURL ''), чтобы не вернуться к cross-origin и проблемам с cookie.
// В prod — URL из env.
const baseURL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true") {
  console.log("[http] baseURL:", baseURL || "(прокси)", "AUTH_DEBUG: on");
}

export const http = axios.create({
  baseURL,
  withCredentials: true,
});

// 1) Подставляем access в Authorization
http.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2) На 401 делаем refresh один раз и повторяем запрос один раз
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (!original) return Promise.reject(error);
    const status = error.response?.status;
    const url = String(original?.url ?? "");
    const isRefresh = url.includes(API.refresh);
    const isLogout = url.includes(API.logout);

    if (status === 401 && !original?._retry && !isRefresh && !isLogout) {
      original._retry = true;
      authLog("401_INTERCEPT", { url: url.slice(-40), hadAccess: getAccess() !== null });

      const hadAccessBeforeRefresh = getAccess() !== null;
      try {
        await refreshSessionForce();
        const res = await http(original);
        authLog("RETRY_OK", { url: url.slice(-40) });
        return res;
      } catch {
        authLog("RETRY_FAIL", { url: url.slice(-40), hadAccess: hadAccessBeforeRefresh });
        await doLogout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
