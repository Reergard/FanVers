import axios from "axios";

// Чистый axios instance без интерцепторов для refresh/logout
// Используется чтобы избежать циклических зависимостей и рекурсии в интерцепторах
export const httpRaw = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  withCredentials: true, // КРИТИЧНО: чтобы cookie refresh_token летала
});
