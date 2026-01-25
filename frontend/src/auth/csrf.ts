import axios from "axios";
import { API } from "../api/endpoints";
import { setCsrf } from "./store";

export async function fetchCsrfToken() {
  // Используем прямой axios вызов, чтобы избежать циклической зависимости с http.ts
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";
  const { data } = await axios.get(`${baseURL}${API.csrf}`, { withCredentials: true });
  setCsrf(data.csrfToken);
  return data.csrfToken as string;
}
