/**
 * AnalyticsProvider — connects GA4 and Meta Pixel to the
 * cookie consent system and React Router.
 *
 * Place this component inside <BrowserRouter> so it can read location.
 *
 * Behaviour:
 *  - analytics consent granted  => init GA4 + Meta Pixel, track page views
 *  - analytics consent revoked  => destroy GA4 + Meta Pixel
 *  - route changes              => send page_view to GA4 + PageView to Meta Pixel
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
import { initMetaPixel, destroyMetaPixel, trackPixelEvent } from "./metaPixel";
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

  // --- GA4 + Meta Pixel lifecycle tied to consent ---
  useEffect(() => {
    if (analyticsAllowed) {
      initGA4();
      initMetaPixel();
    } else {
      destroyGA4();
      destroyMetaPixel();
    }
  }, [analyticsAllowed]);

  // --- Track SPA page views ---
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!analyticsAllowed) return;

    if (isFirstRender.current) {
      // Send initial page view
      trackPageView(location.pathname + location.search);
      // Meta Pixel initial PageView is sent in initMetaPixel()
      isFirstRender.current = false;
      return;
    }

    // Subsequent SPA navigations
    trackPageView(location.pathname + location.search);
    trackPixelEvent("PageView");
  }, [location.pathname, location.search, analyticsAllowed]);

  return null; // renderless component
}
