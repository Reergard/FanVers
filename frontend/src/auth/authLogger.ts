/**
 * Централизованное логирование событий авторизации.
 * В dev-режиме включается через VITE_AUTH_DEBUG=true.
 * Не логируем "cookie есть/нет" — HttpOnly cookie в JS не видна.
 */

const AUTH_DEBUG =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true";

export type AuthEvent =
  | "LOGIN_OK"
  | "REFRESH_START"
  | "REFRESH_OK"
  | "REFRESH_401"
  | "401_INTERCEPT"
  | "RETRY_OK"
  | "RETRY_FAIL"
  | "LOGOUT_OK";

export function authLog(event: AuthEvent, detail?: Record<string, unknown>): void {
  if (!AUTH_DEBUG) return;
  const payload = detail ? { ...detail } : {};
  console.log(`[AUTH] ${event}`, Object.keys(payload).length ? payload : "");
}
