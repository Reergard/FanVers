/**
 * Meta Pixel (Facebook/Instagram) — conditional loader.
 *
 * Like GA4, the pixel loads ONLY when the user has given analytics
 * cookie consent.  The fbevents.js script is injected dynamically
 * and removed if consent is revoked.
 */

const PIXEL_ID = "1978242316129462";

let initialized = false;

/** Inject the Meta Pixel base script */
function injectPixelScript(): void {
  if (document.getElementById("meta-pixel")) return;

  const script = document.createElement("script");
  script.id = "meta-pixel";
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

/** Remove the injected script */
function removePixelScript(): void {
  const script = document.getElementById("meta-pixel");
  if (script) script.remove();
}

/** Initialize Meta Pixel (call once when analytics consent is granted) */
export function initMetaPixel(): void {
  if (initialized) return;

  // fbq stub — queues calls until fbevents.js loads
  if (!window.fbq) {
    const fbq: any = function () {
      // eslint-disable-next-line prefer-rest-params
      fbq.callMethod
        ? fbq.callMethod.apply(fbq, arguments)
        : fbq.queue.push(arguments);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [] as any[];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  injectPixelScript();

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");

  initialized = true;
}

/** Tear down Meta Pixel (call when analytics consent is revoked) */
export function destroyMetaPixel(): void {
  if (!initialized) return;

  removePixelScript();
  window.fbq = undefined;
  window._fbq = undefined;

  initialized = false;
}

/** Track a standard Meta Pixel event */
export function trackPixelEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!initialized || !window.fbq) return;
  window.fbq("track", eventName, params);
}

/** Track a custom Meta Pixel event */
export function trackPixelCustomEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!initialized || !window.fbq) return;
  window.fbq("trackCustom", eventName, params);
}

/* ------------------------------------------------------------------ */
/*  TypeScript: extend Window with fbq                                */
/* ------------------------------------------------------------------ */
declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}
