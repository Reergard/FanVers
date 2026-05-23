const FIELD_LABELS: Record<string, string> = {
  country: "Країна",
  full_name_legal: "ПІБ рідною мовою",
  full_name_latin: "ПІБ латиницею",
  address_line: "Адреса",
  city: "Місто",
  postal_code: "Поштовий індекс",
  iban: "IBAN",
  bic_swift: "BIC/SWIFT",
  recipient_full_name: "Ім'я отримувача",
  currency: "Валюта",
  non_field_errors: "",
};

/**
 * Extracts a user-friendly error message from an API error response.
 * Handles both `{error: "..."}` and DRF validation `{field: ["msg"]}` formats.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const axErr = err as { response?: { status?: number; data?: Record<string, unknown> } };
  const status = axErr?.response?.status;
  if (status === 429) return "Забагато запитів. Спробуйте пізніше.";
  const resp = axErr?.response?.data;
  if (!resp) return fallback;

  // Format: { error: "string" }
  if (typeof resp.error === "string") return resp.error;

  // Format: { detail: "string" } (DRF generic)
  if (typeof resp.detail === "string") return resp.detail;

  // Format: { field: ["message", ...], ... } (DRF validation)
  const messages: string[] = [];
  for (const [key, val] of Object.entries(resp)) {
    if (key === "error" || key === "detail") continue;
    const label = FIELD_LABELS[key] ?? key;
    const msgList = Array.isArray(val) ? val : [val];
    for (const msg of msgList) {
      if (typeof msg !== "string") continue;
      if (label) {
        messages.push(`${label}: ${msg}`);
      } else {
        messages.push(msg);
      }
    }
  }

  return messages.length > 0 ? messages.join(". ") : fallback;
}
