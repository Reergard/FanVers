/**
 * Placeholder для обкладинки книги, коли зображення відсутнє в БД.
 * SVG: сірий прямокутник у форматі обкладинки.
 */
const DEFAULT_COVER_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='280' viewBox='0 0 200 280'%3E%3Crect fill='%23e0e0e0' width='200' height='280'/%3E%3C/svg%3E";

export const DEFAULT_COVER_URL = DEFAULT_COVER_PLACEHOLDER;

/**
 * Повертає URL обкладинки книги з БД, або placeholder якщо зображення відсутнє.
 * Використовується для карток книг, закладок, реклами — всюди, де має бути обкладинка з БД.
 */
export function resolveBookCoverUrl(image?: string | null): string {
  const normalized = (image ?? "").trim();
  if (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return DEFAULT_COVER_URL;
  }
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }
  if (
    normalized.startsWith("/static/") ||
    normalized.startsWith("/media/")
  ) {
    const envBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
    const isAbsoluteBase = /^https?:\/\//i.test(envBase);
    const absoluteBaseOrigin = isAbsoluteBase ? new URL(envBase).origin : "";
    if (import.meta.env.DEV) return `http://127.0.0.1:8000${normalized}`;
    if (absoluteBaseOrigin) return `${absoluteBaseOrigin}${normalized}`;
    return normalized;
  }
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (base) {
    return `${base}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  }
  if (import.meta.env.DEV && normalized.startsWith("/")) {
    return `http://127.0.0.1:8000${normalized}`;
  }
  return normalized;
}
