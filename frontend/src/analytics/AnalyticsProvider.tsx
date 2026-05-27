/**
 * AnalyticsProvider — connects GA4 (and future Meta Pixel) to the
 * cookie consent system and React Router.
 *
 * Place this component inside <BrowserRouter> so it can read location.
 *
 * Behaviour:
 *  - analytics consent granted  => init GA4, track page views
 *  - analytics consent revoked  => destroy GA4
 *  - route changes              => send page_view to GA4
 *  - first load                 => capture & clean UTM params
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSyncExternalStore } from "react";
import {
  getCookieConsent,
  subscribeCookieConsent,
} from "../settings/cookieConsentStore";
import { initGA4, destroyGA4, trackPageView } from "./ga4";
import { captureUtm } from "./utm";

export function AnalyticsProvider() {
  const location = useLocation();

  // Subscribe to cookie consent reactively (without needing useAuth)
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsent,
    getCookieConsent,
  );

  const analyticsAllowed = consent?.analytics === true;

  // --- UTM capture (once, on mount) ---
  const utmCaptured = useRef(false);
  useEffect(() => {
    if (!utmCaptured.current) {
      captureUtm();
      utmCaptured.current = true;
    }
  }, []);

  // --- GA4 lifecycle tied to consent ---
  useEffect(() => {
    if (analyticsAllowed) {
      initGA4();
    } else {
      destroyGA4();
    }
  }, [analyticsAllowed]);

  // --- Track SPA page views ---
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!analyticsAllowed) return;

    // On first render initGA4 already sends the initial page view via
    // config hit, so we skip the duplicate.  On subsequent navigations
    // we fire manually.
    if (isFirstRender.current) {
      // Send initial page view (config has send_page_view:false)
      trackPageView(location.pathname + location.search);
      isFirstRender.current = false;
      return;
    }

    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, analyticsAllowed]);

  return null; // renderless component
}
