import ghostAvatar from "../../assets/icons/Ghost.svg";

export const DEFAULT_AVATAR_URL = ghostAvatar;

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const normalized = (avatarUrl ?? "").trim();
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return DEFAULT_AVATAR_URL;
  }
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
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

  // Backend can return "/static/..." fallback path. Do not prepend "/api" proxy prefix.
  if (normalized.startsWith("/static/") || normalized.startsWith("/media/")) {
    if (import.meta.env.DEV) return `http://127.0.0.1:8000${normalized}`;
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
