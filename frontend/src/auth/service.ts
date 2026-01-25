import { http } from "../api/http";
import { API } from "../api/endpoints";
import { setAccess } from "./token";
import { runSingleFlight } from "./refreshMutex";
import { doRefresh, doLogout } from "./refreshCore";

// ВАЖНО: login/register — csrf_exempt, но refresh/logout — требуют CSRF

// ============================================================================
// ПУБЛИЧНЫЕ ФУНКЦИИ ДЛЯ АВТОРИЗАЦИИ
// ============================================================================

export async function loginSession(payload: { username: string; password: string }) {
  const baseURL = import.meta.env.DEV 
    ? (import.meta.env.VITE_API_BASE_URL || "")
    : (import.meta.env.VITE_API_BASE_URL ?? "");
  const fullUrl = `${baseURL}${API.login}`;
  console.log("[service.ts] Login POST", fullUrl, "baseURL:", baseURL || "(используется прокси Vite)");
  
  try {
    const { data } = await http.post(API.login, payload, { withCredentials: true });
    console.log("[service.ts] Login успешен, получен access токен");
    
    // Проверяем наличие refresh cookie после логина
    // ВАЖНО: httponly cookie не видна через document.cookie, но это нормально
    // Браузер автоматически отправит её в запросах с withCredentials: true
    setTimeout(() => {
      const refreshCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("refresh_token="));
      console.log("[service.ts] Refresh cookie после логина:", refreshCookie ? "есть" : "отсутствует (нормально для httponly)");
      if (refreshCookie) {
        console.log("[service.ts] Refresh cookie значение:", refreshCookie.substring(0, 50) + "...");
      }
    }, 100);
    
    setAccess(data.access);
    return data;
  } catch (error: any) {
    console.error("[service.ts] Login error:", error.message, "URL:", fullUrl, "Status:", error.response?.status);
    throw error;
  }
}

export async function registerSession(payload: {
  username: string;
  email: string;
  password: string;
  re_password: string;
}) {
  const baseURL = import.meta.env.DEV 
    ? (import.meta.env.VITE_API_BASE_URL || "")
    : (import.meta.env.VITE_API_BASE_URL ?? "");
  const fullUrl = `${baseURL}${API.register}`;
  console.log("[service.ts] Register POST", fullUrl, "baseURL:", baseURL || "(используется прокси Vite)");
  
  try {
    const { data } = await http.post(API.register, payload, { withCredentials: true });
    console.log("[service.ts] Register успешен", data?.access ? "с access токеном" : "без access токена");
    console.log("[service.ts] Register response data:", { 
      hasAccess: !!data?.access, 
      accessLength: data?.access?.length || 0,
      keys: Object.keys(data || {})
    });
    // У тебя сейчас токены могут выдаваться сразу после регистрации (по описанию)
    if (data?.access) {
      console.log("[service.ts] Устанавливаем access токен после регистрации");
      setAccess(data.access);
    } else {
      console.warn("[service.ts] ⚠️ Access токен отсутствует в ответе регистрации!");
    }
    return data;
  } catch (error: any) {
    console.error("[service.ts] Register error:", error.message, "URL:", fullUrl, "Status:", error.response?.status);
    throw error;
  }
}

// ============================================================================
// REFRESH И LOGOUT - ВСЕГДА ЧЕРЕЗ MUTEX И httpRaw (БЕЗ ИНТЕРЦЕПТОРОВ)
// ============================================================================

// Публичная функция, всегда использующая single-flight mutex
// Используется в интерцепторах и явных вызовах
export function refreshSession() {
  return runSingleFlight(() => doRefresh(false));
}

// Тихая версия refresh для bootstrap/onFocus - не логирует ошибки как error
// Используется при загрузке страницы и автоматическом обновлении токена
export function refreshSessionSilent() {
  return runSingleFlight(() => doRefresh(true));
}

// Logout всегда через doLogout (httpRaw, без интерцепторов)
export async function logoutSession() {
  return doLogout();
}

// Проверка статуса (требует access)
export async function authStatus() {
  const { data } = await http.get(API.authStatus, { withCredentials: true });
  return data;
}
