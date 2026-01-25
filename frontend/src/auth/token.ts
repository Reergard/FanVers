let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function setAccess(token: string | null) {
  const changed = accessToken !== token;
  const oldToken = accessToken;
  accessToken = token;
  console.log("[token.ts] setAccess:", { 
    old: oldToken ? "есть" : "null", 
    new: token ? "есть" : "null", 
    changed,
    listenersCount: listeners.size 
  });
  if (changed) {
    // Уведомляем всех подписчиков об изменении
    console.log("[token.ts] Уведомляем подписчиков об изменении токена");
    listeners.forEach((listener) => listener());
  }
}

export function getAccess() {
  return accessToken;
}

/**
 * Подписка на изменения access токена
 * @returns функция отписки
 */
export function subscribeAccessToken(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Опционально: проверить exp без запросов (JWT payload)
export function getJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload?.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
