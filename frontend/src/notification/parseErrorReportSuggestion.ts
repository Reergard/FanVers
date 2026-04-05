/**
 * Розбирає поле suggestion з API (формат з errorReportApi.buildBackendBody).
 */
export function parseErrorReportSuggestion(suggestion: string | null | undefined): {
  typeLabel: string;
  comment: string;
} {
  const s = suggestion?.trim();
  if (!s) return { typeLabel: "—", comment: "—" };

  const lines = s.split(/\r?\n/);
  const first = lines[0] ?? "";
  const typeMatch = first.match(/^Тип помилки:\s*(.+)$/i);

  if (!typeMatch) {
    return { typeLabel: "—", comment: s };
  }

  const typeLabel = typeMatch[1].trim() || "—";
  let startIdx = 1;
  while (startIdx < lines.length && !lines[startIdx].trim()) {
    startIdx += 1;
  }

  let rest = lines.slice(startIdx).join("\n").trim();
  if (/^коментар:\s*/i.test(rest)) {
    rest = rest.replace(/^коментар:\s*/i, "").trim();
  }

  const comment = rest || "—";
  return { typeLabel, comment };
}
