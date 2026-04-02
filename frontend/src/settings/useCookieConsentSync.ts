import { useEffect, useRef } from "react";
import { useAuth } from "../auth/useAuth";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "./cookieConsentStore";
import { getCookieConsentRemote, putCookieConsentRemote } from "./cookieConsentApi";

function normalizeRemoteConsent(value: CookieConsent | null): CookieConsent | null {
  if (!value) return null;
  if (value.necessary !== true) return null;
  return {
    necessary: true,
    preferences: value.preferences === true,
    analytics: value.analytics === true,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
  };
}

export function useCookieConsentSync() {
  const { isAuthenticated, authReady } = useAuth();
  const lastSyncedUserSessionRef = useRef<"none" | "synced">("none");

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      lastSyncedUserSessionRef.current = "none";
      return;
    }
    if (lastSyncedUserSessionRef.current === "synced") return;

    let cancelled = false;

    (async () => {
      try {
        const local = getCookieConsent();
        const remoteRaw = await getCookieConsentRemote();
        const remote = normalizeRemoteConsent(remoteRaw);

        if (cancelled) return;

        if (remote == null && local != null) {
          const saved = await putCookieConsentRemote({
            necessary: true,
            preferences: local.preferences,
            analytics: local.analytics,
          });
          if (!cancelled) {
            setCookieConsent(saved);
          }
        } else if (remote != null) {
          setCookieConsent(remote);
        }

        if (!cancelled) {
          lastSyncedUserSessionRef.current = "synced";
        }
      } catch {
        // Silent: consent sync must not break app bootstrap/login.
        if (!cancelled) {
          lastSyncedUserSessionRef.current = "synced";
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);
}

