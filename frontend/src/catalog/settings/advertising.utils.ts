import type { AdvertisingSlotKey } from "./advertising.types";
import { SLOT_PRICE_PER_DAY } from "./advertising.constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Чи end раніше за start (для YYYY-MM-DD — порівняння рядків без зсуву UTC). */
export function isEndBeforeStartIso(start: string, end: string): boolean {
  if (!start || !end) return false;
  if (ISO_DATE.test(start) && ISO_DATE.test(end)) {
    return end < start;
  }
  const a = new Date(start);
  const b = new Date(end);
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && b < a;
}

/** Розрахунок кількості днів (inclusive: start і end включені) */
export function calcDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  if (isEndBeforeStartIso(startDate, endDate)) return 0;
  if (ISO_DATE.test(startDate) && ISO_DATE.test(endDate)) {
    const [ys, ms, ds] = startDate.split("-").map(Number);
    const [ye, me, de] = endDate.split("-").map(Number);
    const t0 = new Date(ys, ms - 1, ds).getTime();
    const t1 = new Date(ye, me - 1, de).getTime();
    const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays) + 1;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + 1;
}

/** Вартість позиції за ключем слота */
export function calcCost(
  startDate: string,
  endDate: string,
  slotKey: AdvertisingSlotKey
): number {
  const days = calcDays(startDate, endDate);
  const pricePerDay = SLOT_PRICE_PER_DAY[slotKey];
  return days * pricePerDay;
}

/** Формат дати для input[type="date"]: YYYY-MM-DD */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMinStartDate(): string {
  return toDateInputValue(new Date());
}

export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return false;
  if (ISO_DATE.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const candidate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    candidate.setHours(0, 0, 0, 0);
    return candidate < today;
  }
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function isDateRangeValid(
  startDate: string,
  endDate: string
): boolean {
  if (!startDate || !endDate) return false;
  return !isEndBeforeStartIso(startDate, endDate);
}

export type PlacementValidationResult =
  | { valid: true }
  | { valid: false; message: string };

/** hasTarget: потрібен обраний targetId (жанр/тег/фендом) */
export function validatePlacement(
  startDate: string,
  endDate: string,
  targetId: number | null,
  hasTarget: boolean
): PlacementValidationResult {
  if (!startDate || !endDate) {
    return { valid: false, message: "Будь ласка, виберіть дати" };
  }
  if (isDateInPast(startDate)) {
    return { valid: false, message: "Дата початку не може бути в минулому" };
  }
  if (!isDateRangeValid(startDate, endDate)) {
    return {
      valid: false,
      message: "Дата закінчення не може бути раніше дати початку",
    };
  }
  if (hasTarget && !targetId) {
    return { valid: false, message: "Будь ласка, оберіть об'єкт для таргетингу" };
  }
  return { valid: true };
}
