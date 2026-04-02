import { http } from "../api/http";
import { API } from "../api/endpoints";
import type { CookieConsent } from "./cookieConsentStore";

type CookieConsentResponse = { cookie_consent: CookieConsent | null };

export async function getCookieConsentRemote(): Promise<CookieConsent | null> {
  const { data } = await http.get<CookieConsentResponse>(API.cookieConsent);
  return data.cookie_consent ?? null;
}

export async function putCookieConsentRemote(consent: {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
}): Promise<CookieConsent> {
  const { data } = await http.put<CookieConsentResponse>(
    API.cookieConsent,
    consent
  );
  if (!data.cookie_consent) {
    throw new Error("cookie_consent is empty");
  }
  return data.cookie_consent;
}

