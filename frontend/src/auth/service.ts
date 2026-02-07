import { http } from "../api/http";
import { API } from "../api/endpoints";
import { setAccess, getAccess, getJwtExpMs } from "./token";
import { runSingleFlight } from "./refreshMutex";
import { doRefresh, doLogout, refreshSessionForce } from "./refreshCore";
import { setAuthAnonymous, setAuthAuthenticated } from "./store";
import { authLog } from "./authLogger";

// ВАЖНО: login/register — csrf_exempt, но refresh/logout — требуют CSRF

const COOLDOWN_MS = 20_000;       // не чаще раза в 20 сек для proactive
const EXP_SOON_MS = 60_000;       // refresh, если до истечения access < 60 сек
let lastProactiveRefreshAt = 0;

function shouldProactivelyRefresh(): boolean {
  const now = Date.now();
  const access = getAccess();
  if (!access) return true; // bootstrap: F5 без access — всегда пробуем refresh

  if (now - lastProactiveRefreshAt < COOLDOWN_MS) return false;

  const expMs = getJwtExpMs(access);
  if (expMs == null) return true;

  return expMs - now < EXP_SOON_MS;
}

// ============================================================================
// ПУБЛИЧНЫЕ ФУНКЦИИ ДЛЯ АВТОРИЗАЦИИ
// ============================================================================

export async function loginSession(payload: { username: string; password: string }) {
  try {
    const { data } = await http.post(API.login, payload, { withCredentials: true });
    setAccess(data.access);
    authLog("LOGIN_OK", { hasAccess: !!data?.access });
    try {
      const userData = await authStatus();
      setAuthAuthenticated({
        userId: userData?.userId ?? null,
        username: userData?.username ?? null,
        balance: userData?.balance ?? null,
      });
    } catch {
      setAuthAnonymous();
    }
    return data;
  } catch (error: any) {
    console.error("[service] login error", error.message, "status:", error.response?.status);
    throw error;
  }
}

export async function registerSession(payload: {
  username: string;
  email: string;
  password: string;
  re_password: string;
}) {
  try {
    const { data } = await http.post(API.register, payload, { withCredentials: true });
    if (data?.access) {
      setAccess(data.access);
      authLog("LOGIN_OK", { source: "register", hasAccess: true });
      try {
        const userData = await authStatus();
        setAuthAuthenticated({
          userId: userData?.userId ?? null,
          username: userData?.username ?? null,
          balance: userData?.balance ?? null,
        });
      } catch {
        setAuthAnonymous();
      }
    }
    return data;
  } catch (error: any) {
    console.error("[service] register error", error.message, "status:", error.response?.status);
    throw error;
  }
}

// ============================================================================
// REFRESH И LOGOUT - ВСЕГДА ЧЕРЕЗ MUTEX И httpRaw (БЕЗ ИНТЕРЦЕПТОРОВ)
// ============================================================================

// Proactive: уважает cooldown и exp (bootstrap / onFocus / visibility)
export function refreshSessionSilent(opts?: { fromBootstrap?: boolean }): Promise<string | null> {
  // Для гостей (focus/visibility) не дёргаем /refresh/ — bootstrap уже пробовал
  if (!opts?.fromBootstrap && !getAccess()) return Promise.resolve(null);
  if (!shouldProactivelyRefresh()) return Promise.resolve(null);

  return runSingleFlight(async () => {
    const token = await doRefresh();
    lastProactiveRefreshAt = Date.now(); // только при успехе — при сбое не штрафуем cooldown'ом
    return token;
  });
}

// Force: без cooldown — для 401-interceptor (reactive refresh). Реализация в refreshCore.
export { refreshSessionForce };

// Явный refresh (с логами), без cooldown
export function refreshSession() {
  return refreshSessionForce();
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

/** Принудительно обновить auth store (username, balance) — после deposit/withdraw */
export async function refreshAuthStatus(): Promise<void> {
  const token = getAccess();
  if (!token) return;
  try {
    const userData = await authStatus();
    setAuthAuthenticated({
      userId: userData?.userId ?? null,
      username: userData?.username ?? null,
      balance: userData?.balance ?? null,
    });
  } catch {
    // Ignore — не сбрасываем, если сервер временно недоступен
  }
}
