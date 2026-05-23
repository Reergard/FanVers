const IBAN_COUNTRY_TO_CURRENCY: Record<string, string> = {
  UA: "UAH",
  HU: "HUF",
  CZ: "CZK",
  PL: "PLN",
  RO: "RON",
  BG: "BGN",
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  DK: "DKK",
  NO: "NOK",
  // Єврозона
  DE: "EUR", AT: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  PT: "EUR", NL: "EUR", BE: "EUR", IE: "EUR", FI: "EUR",
  GR: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR",
  LT: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

export const SUPPORTED_CURRENCIES = [
  "UAH", "EUR", "USD", "GBP", "CZK", "PLN", "HUF",
  "RON", "BGN", "CHF", "SEK", "DKK", "NOK",
];

export function detectCurrencyByIban(iban: string): string | null {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  if (clean.length < 2) return null;
  const countryCode = clean.slice(0, 2);
  return IBAN_COUNTRY_TO_CURRENCY[countryCode] ?? null;
}
