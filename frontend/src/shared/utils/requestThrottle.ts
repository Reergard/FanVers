/**
 * Обмеження частоти запитів (throttling) для рейтингів та інших дій.
 * Мінімальний інтервал між запитами, ліміт на хвилину, single-flight по ключу.
 */

const MIN_INTERVAL_MS = 100;
const MAX_REQUESTS_PER_MINUTE = 30;
const RESET_INTERVAL_MS = 60_000;

class RequestThrottle {
  private pendingRequests = new Map<string, Promise<unknown>>();
  private lastRequestTime = new Map<string, number>();
  private requestCounts = new Map<string, number>();

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(key) ?? 0;
    if (now - lastTime < MIN_INTERVAL_MS) return false;
    const count = this.requestCounts.get(key) ?? 0;
    if (count >= MAX_REQUESTS_PER_MINUTE) return false;
    return true;
  }

  private updateRequestStats(key: string): void {
    this.lastRequestTime.set(key, Date.now());
    const count = this.requestCounts.get(key) ?? 0;
    this.requestCounts.set(key, count + 1);
    setTimeout(() => this.requestCounts.delete(key), RESET_INTERVAL_MS);
  }

  addRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }
    if (!this.canMakeRequest(key)) {
      return new Promise<T>((resolve) => {
        setTimeout(() => resolve(this.addRequest(key, requestFn)), MIN_INTERVAL_MS);
      });
    }
    this.updateRequestStats(key);
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });
    this.pendingRequests.set(key, promise);
    return promise as Promise<T>;
  }
}

export const requestThrottle = new RequestThrottle();

export function createRequestKey(
  bookSlug: string,
  ratingType: string,
  action: "fetch" | "submit" = "fetch"
): string {
  return `${action}_${bookSlug}_${ratingType}`;
}
