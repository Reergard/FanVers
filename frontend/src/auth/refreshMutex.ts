import { getAccess } from "./token";

const COOLDOWN_MS = 20_000;
let inflight: Promise<string> | null = null;
let lastSuccessAt = 0;

function isTokenAlive(token: string, marginMs = 5000): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const p = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof p.exp !== "number") return false;
    return p.exp * 1000 > Date.now() + marginMs;
  } catch {
    return false;
  }
}

export function runSingleFlight(
  fn: () => Promise<string>,
  opts?: { force?: boolean }
): Promise<string> {
  const now = Date.now();
  const current = getAccess();
  // force: при 401 всегда делать реальный refresh, не возвращать старый access из cooldown.
  // Иначе retry уйдёт с тем же токеном → снова 401 → _retry=true → разлогин.
  if (!opts?.force) {
    // Не дергать refresh чаще раз в COOLDOWN_MS, если access уже есть (focus/visibility дребезг).
    // Если access нет — всегда делаем refresh (F5, гость после истечения).
    if (current && now - lastSuccessAt < COOLDOWN_MS && isTokenAlive(current)) {
      return Promise.resolve(current);
    }
  }
  if (!inflight) {
    inflight = fn()
      .then((t) => {
        lastSuccessAt = Date.now();
        return t;
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}
