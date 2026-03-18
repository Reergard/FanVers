import type { PlacementType } from "./advertising.types";
import { PRICE_PER_DAY } from "./advertising.constants";

/** Розрахунок кількості днів (inclusive: start і end включені) */
export function calcDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + 1;
}

/** Розрахунок вартості: days * pricePerDay */
export function calcCost(
  startDate: string,
  endDate: string,
  placementType: PlacementType
): number {
  const days = calcDays(startDate, endDate);
  const pricePerDay = PRICE_PER_DAY[placementType];
  return days * pricePerDay;
}

/** Формат дати для input[type="date"]: YYYY-MM-DD (локальна дата) */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Мінімальна дата для початку (сьогодні, локальний часовий пояс) */
export function getMinStartDate(): string {
  return toDateInputValue(new Date());
}

/** Перевірка: дата не в минулому */
export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/** Перевірка: endDate >= startDate */
export function isDateRangeValid(
  startDate: string,
  endDate: string
): boolean {
  if (!startDate || !endDate) return false;
  return new Date(endDate) >= new Date(startDate);
}

export type PlacementValidationResult =
  | { valid: true }
  | { valid: false; message: string };

/** Валідація однієї позиції перед додаванням в заказ */
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
    return { valid: false, message: "Дата закінчення не може бути раніше дати початку" };
  }
  if (hasTarget && !targetId) {
    return { valid: false, message: "Будь ласка, оберіть тип таргету" };
  }
  return { valid: true };
}
