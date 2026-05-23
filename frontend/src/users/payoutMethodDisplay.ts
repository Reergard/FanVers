import type { PayoutMethod } from "./types";

/** Повний IBAN для відображення власнику (ніколи не маскуємо у формі виведення). */
export function payoutMethodFullIban(method: PayoutMethod | null | undefined): string {
  if (!method) return "";
  const raw = (method.iban_full ?? method.iban ?? "").trim();
  const normalized = raw.replace(/\s/g, "").toUpperCase();
  if (normalized.length >= 15 && !normalized.startsWith("[")) {
    return normalized;
  }
  return "";
}

export function payoutMethodBic(method: PayoutMethod): string {
  return (method.bic_swift_display ?? "").trim();
}
