import { http } from "../api/http";
import { API } from "../api/endpoints";
import { setAccess } from "./token";
import { runSingleFlight } from "./refreshMutex";
import { doRefresh, doLogout } from "./refreshCore";

// ВАЖНО: login/register — csrf_exempt, но refresh/logout — требуют CSRF

export async function loginSession(payload: { username: string; password: string }) {
  const { data } = await http.post(API.login, payload, { withCredentials: true });
  setAccess(data.access);
  return data;
}

export async function registerSession(payload: {
  username: string;
  email: string;
  password: string;
  re_password: string;
}) {
  const { data } = await http.post(API.register, payload, { withCredentials: true });
  // У тебя сейчас токены могут выдаваться сразу после регистрации (по описанию)
  if (data?.access) setAccess(data.access);
  return data;
}

// Публичная функция, всегда использующая single-flight mutex
export function refreshSession() {
  return runSingleFlight(doRefresh);
}

export async function logoutSession() {
  return doLogout();
}

// Проверка статуса (требует access)
export async function authStatus() {
  const { data } = await http.get(API.authStatus, { withCredentials: true });
  return data;
}
