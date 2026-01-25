import axios from "axios";

// Чистый axios instance без интерцепторов для refresh/logout
// Используется чтобы избежать циклических зависимостей и рекурсии в интерцепторах
// В dev режиме используем прокси Vite (относительные пути)
// В prod режиме используем полный URL из env
const baseURL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_BASE_URL || "") // Если не установлен, используем прокси (пустой baseURL)
  : (import.meta.env.VITE_API_BASE_URL ?? "");
console.log("[httpRaw.ts] baseURL:", baseURL || "(используется прокси Vite)", "DEV:", import.meta.env.DEV);

export const httpRaw = axios.create({
  baseURL,
  withCredentials: true, // КРИТИЧНО: чтобы cookie refresh_token летала
});
