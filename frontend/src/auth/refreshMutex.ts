import { getAccess } from "./token";

const COOLDOWN_MS = 20_000;
let inflight: Promise<string> | null = null;
let lastSuccessAt = 0;

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
    if (current && now - lastSuccessAt < COOLDOWN_MS) {
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
