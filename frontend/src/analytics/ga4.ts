/**
 * Google Analytics 4 — conditional loader.
 *
 * GA4 loads ONLY when the user has given analytics cookie consent.
 * The gtag script is injected dynamically and removed if consent is revoked.
 */

const GA4_ID = "G-J9978WWKVX";

let initialized = false;

/** Dynamically inject the gtag.js script tag */
function injectGtagScript(): void {
  if (document.getElementById("ga4-gtag")) return;

  const script = document.createElement("script");
  script.id = "ga4-gtag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);
}

/** Remove the injected script and clean up global state */
function removeGtagScript(): void {
  const script = document.getElementById("ga4-gtag");
  if (script) script.remove();
}

/** Initialize GA4 (call once when analytics consent is granted) */
export function initGA4(): void {
  if (initialized) return;

  injectGtagScript();

  window.dataLayer = window.dataLayer || [];
  // Must use `arguments` object (NOT rest params) — gtag.js expects Arguments, not Array
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, {
    send_page_view: false, // we send page views manually on route change
  });

  initialized = true;
}

/** Tear down GA4 (call when analytics consent is revoked) */
export function destroyGA4(): void {
  if (!initialized) return;

  removeGtagScript();

  // Set opt-out flag recognised by gtag
  (window as any)[`ga-disable-${GA4_ID}`] = true;

  initialized = false;
}

/** Send a page_view event for SPA route changes */
export function trackPageView(path: string, title?: string): void {
  if (!initialized || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
  });
}

/** Send a custom GA4 event */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!initialized || !window.gtag) return;
  window.gtag("event", eventName, params);
}

/* ------------------------------------------------------------------ */
/*  TypeScript: extend Window with gtag / dataLayer                   */
/* ------------------------------------------------------------------ */
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}
