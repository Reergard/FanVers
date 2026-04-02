import { useCookieConsentSync } from "./useCookieConsentSync";

export function CookieConsentSyncRoot() {
  useCookieConsentSync();
  return null;
}

