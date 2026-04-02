const KEY = "cookieConsent";
const TECH_COOKIE_NAME = "fv_cookie_consent";

export type CookieConsent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  updated_at?: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeLocalConsent(value: any): CookieConsent | null {
  if (!value || typeof value !== "object") return null;
  const necessary = value.necessary === true;
  if (!necessary) return null;
  const preferences = value.preferences === true;
  const analytics = value.analytics === true;
  const updated_at = typeof value.updated_at === "string" ? value.updated_at : undefined;
  return { necessary: true, preferences, analytics, updated_at };
}

function setTechnicalConsentCookie() {
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TECH_COOKIE_NAME}=1; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

// useSyncExternalStore requires that getSnapshot returns a stable reference
// when the underlying data has not changed. We cache by localStorage raw string.
let lastRaw: string | null = null;
let lastSnapshot: CookieConsent | null = null;

export function getCookieConsent(): CookieConsent | null {
  const raw = window.localStorage.getItem(KEY);
  if (raw === lastRaw) return lastSnapshot;
  lastRaw = raw;
  lastSnapshot = normalizeLocalConsent(safeParseJson(raw));
  return lastSnapshot;
}

export function hasCookieConsentDecision(): boolean {
  return getCookieConsent() != null;
}

export function setCookieConsent(consent: Omit<CookieConsent, "updated_at"> & { updated_at?: string }): void {
  const normalized: CookieConsent = {
    necessary: true,
    preferences: Boolean(consent.preferences),
    analytics: Boolean(consent.analytics),
    updated_at: consent.updated_at,
  };
  const serialized = JSON.stringify(normalized);
  // keep cache consistent for immediate reads in the same tick
  lastRaw = serialized;
  lastSnapshot = normalized;
  window.localStorage.setItem(KEY, serialized);
  setTechnicalConsentCookie();
  emit();
}

export function setCookieConsentRejectAll(): void {
  setCookieConsent({ necessary: true, preferences: false, analytics: false });
}

export function setCookieConsentAcceptAll(): void {
  setCookieConsent({ necessary: true, preferences: true, analytics: true });
}

window.addEventListener("storage", (event) => {
  if (event.key === KEY) emit();
});

export function subscribeCookieConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
