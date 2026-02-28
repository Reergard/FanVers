import ghostAvatar from "../../assets/icons/Ghost.svg";

export const DEFAULT_AVATAR_URL = ghostAvatar;

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const normalized = (avatarUrl ?? "").trim();
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return DEFAULT_AVATAR_URL;
  }
  // data: та blob: — залишаємо як є
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }
  // Повні URL з бекенду (http://127.0.0.1:8000/media/...) → в dev використовуємо шлях для проксу
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const url = new URL(normalized);
      if (url.pathname.startsWith("/media/") || url.pathname.startsWith("/static/")) {
        if (import.meta.env.DEV) return url.pathname; // same-origin через Vite proxy
        return normalized; // prod — повний URL
      }
    } catch {
      /* ignore */
    }
    return normalized;
  }
  // Already-resolved frontend asset paths (Vite dev/build) must stay untouched.
  if (
    normalized.startsWith("/src/") ||
    normalized.startsWith("/assets/") ||
    normalized.startsWith("/@fs/")
  ) {
    return normalized;
  }
  // Backend default ghosts should be replaced by the single frontend fallback.
  if (
    normalized.includes("/images/icons/ghost.png") ||
    normalized.includes("/images/icons/ghost_full.png")
  ) {
    return DEFAULT_AVATAR_URL;
  }

  const envBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const isAbsoluteBase = /^https?:\/\//i.test(envBase);
  const absoluteBaseOrigin = isAbsoluteBase ? new URL(envBase).origin : "";

  // Backend media/static: в dev Vite проксує /media → бекенд, повертаємо шлях для same-origin
  if (normalized.startsWith("/static/") || normalized.startsWith("/media/")) {
    if (import.meta.env.DEV) return normalized; // /media/... → прокс на 127.0.0.1:8000
    if (absoluteBaseOrigin) return `${absoluteBaseOrigin}${normalized}`;
    return normalized;
  }

  if (envBase && isAbsoluteBase) {
    const trimmed = envBase.replace(/\/$/, "");
    return `${trimmed}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  }
  if (envBase && envBase.startsWith("/")) {
    // Relative API base like "/api" should not be used for images.
    return normalized;
  }

  // In dev Vite proxies only /api, so /media needs explicit backend host.
  if (import.meta.env.DEV && normalized.startsWith("/")) {
    return `http://127.0.0.1:8000${normalized}`;
  }

  return normalized;
}
