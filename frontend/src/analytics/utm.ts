/**
 * UTM parameter capture & URL cleanup.
 *
 * On first page load reads utm_* query params, persists them to
 * sessionStorage (lifetime = browser tab), then silently removes
 * the query string from the address bar so the user sees a clean URL.
 *
 * GA4 / Meta Pixel read the URL *before* we clean it (script order
 * guaranteed by initGA4 being called first), so attribution is preserved.
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "fv_utm";

export type UtmData = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** Read UTM data that was captured earlier (if any). */
export function getSavedUtm(): UtmData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmData) : null;
  } catch {
    return null;
  }
}

/**
 * Capture UTM params from the current URL, save them, and clean the
 * address bar.  Safe to call multiple times — only the first hit with
 * UTM params is persisted per session.
 */
export function captureUtm(): void {
  const params = new URLSearchParams(window.location.search);

  const utm: UtmData = {};
  let found = false;
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      found = true;
    }
  }

  if (!found) return;

  // Persist (only first touch per session)
  if (!sessionStorage.getItem(STORAGE_KEY)) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  }

  // Remove UTM params from URL but keep any non-UTM params
  for (const key of UTM_KEYS) params.delete(key);
  const remaining = params.toString();
  const cleanUrl =
    window.location.pathname + (remaining ? `?${remaining}` : "") + window.location.hash;

  window.history.replaceState(window.history.state, "", cleanUrl);
}
