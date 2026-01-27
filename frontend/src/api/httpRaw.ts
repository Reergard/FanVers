import axios from "axios";

// Чистый axios instance без интерцепторов для refresh/logout
// В dev — жёстко прокси (baseURL ''); в prod — из env (как в http.ts)
const baseURL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");

export const httpRaw = axios.create({
  baseURL,
  withCredentials: true, // КРИТИЧНО: чтобы cookie refresh_token летала
});
