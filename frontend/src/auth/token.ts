let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAccess(): string | null {
  return accessToken;
}

export function setAccess(token: string | null): void {
  if (accessToken === token) return;
  accessToken = token;
  for (const cb of listeners) cb(accessToken);
}

export function clearAccess(): void {
  setAccess(null);
}

export function subscribeAccessToken(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** exp из JWT (мс), без валидации подписи — только для решения «скоро истекает или нет». */
export function getJwtExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(normalized + padding));
    if (payload?.exp == null) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
