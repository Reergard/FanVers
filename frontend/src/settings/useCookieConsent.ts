import { useSyncExternalStore } from "react";
import { useAuth } from "../auth/useAuth";
import { putCookieConsentRemote } from "./cookieConsentApi";
import {
  getCookieConsent,
  subscribeCookieConsent,
  setCookieConsent,
  type CookieConsent,
} from "./cookieConsentStore";

export function useCookieConsent(): {
  consent: CookieConsent | null;
  updateConsent: (next: { necessary: true; preferences: boolean; analytics: boolean }) => Promise<void>;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
} {
  const { authReady, isAuthenticated } = useAuth();
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsent,
    getCookieConsent
  );

  const updateConsent = async (next: {
    necessary: true;
    preferences: boolean;
    analytics: boolean;
  }) => {
    // Optimistic local write for instant UI
    setCookieConsent(next);

    // Guest / not bootstrapped — local only
    if (!authReady || !isAuthenticated) return;

    try {
      const saved = await putCookieConsentRemote(next);
      setCookieConsent(saved);
    } catch {
      // Keep local decision; remote can be retried later by the user.
    }
  };

  return {
    consent,
    updateConsent,
    acceptAll: () => updateConsent({ necessary: true, preferences: true, analytics: true }),
    rejectAll: () => updateConsent({ necessary: true, preferences: false, analytics: false }),
  };
}
