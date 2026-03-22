import { normalizeBookReaderTopRow } from "../top/normalizeTopReaderRow";
import type { BookReaderTrendDto } from "./types";

/**
 * Нормалізація JSON для **GET /api/analytics_books/trends/** (той самий BookReaderSerializer, окремий шар від ТОПу).
 */
export function normalizeTrendReaderRow(raw: unknown): BookReaderTrendDto | null {
  return normalizeBookReaderTopRow(raw);
}
