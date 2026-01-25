import axios, { AxiosError } from "axios";
import { getAccess } from "../auth/token";
import { API } from "./endpoints";
import { runSingleFlight } from "../auth/refreshMutex";
import { doRefresh, doLogout } from "../auth/refreshCore";

// В dev режиме используем прокси Vite (относительные пути)
// В prod режиме используем полный URL из env
const baseURL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_BASE_URL || "") // Если не установлен, используем прокси (пустой baseURL)
  : (import.meta.env.VITE_API_BASE_URL ?? "");
console.log("[http.ts] baseURL:", baseURL || "(используется прокси Vite)", "DEV:", import.meta.env.DEV);

export const http = axios.create({
  baseURL,
  withCredentials: true, // КРИТИЧНО: чтобы cookie refresh_token летала на refresh/logout
});

// 1) Подставляем access в Authorization
http.interceptors.request.use((config) => {
  const token = getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const fullUrl = config.url ? `${config.baseURL || ""}${config.url}` : "unknown";
  console.log("[http] Request:", config.method?.toUpperCase(), fullUrl);
  return config;
});

// 2) На 401 делаем refresh один раз и повторяем запрос один раз
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as any;
    const status = error.response?.status;

    const url = String(original?.url ?? "");
    const isRefresh = url.includes(API.refresh);
    const isLogout = url.includes(API.logout);

    if (status === 401 && !original?._retry && !isRefresh && !isLogout) {
      original._retry = true;

      // Сохраняем состояние до попытки refresh
      const hadAccessBeforeRefresh = getAccess() !== null;

      try {
        // Используем doRefresh через mutex напрямую (без импорта service.ts)
        // Явно указываем silent=false, так как это не тихий refresh
        await runSingleFlight(() => doRefresh(false));
        return http(original); // Повтор исходного запроса 1 раз
      } catch {
        // Если refresh не удался:
        // - Если был access токен → пользователь был авторизован, но refresh истёк → делаем logout
        // - Если не было access токена → гость → просто возвращаем 401 без logout
        if (hadAccessBeforeRefresh) {
          // Пользователь был авторизован, но refresh истёк - делаем logout для очистки состояния
          await doLogout();
        }
        // Для гостя просто возвращаем 401 без logout (не было состояния для очистки)
      }
    }

    return Promise.reject(error);
  }
);
