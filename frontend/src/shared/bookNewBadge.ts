/** Має збігатися з `NEW_BADGE_DAYS` у `backend/apps/catalog/badge_utils.py`. */
export const NEW_BADGE_DAYS = 7;

function isNewByCreatedAt(createdAt: string | null | undefined): boolean {
  if (createdAt == null || createdAt === "") return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  const maxAge = NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - t <= maxAge;
}

/**
 * Явне поле API з бекенду; якщо його немає в JSON — рахуємо по `created_at` (той самий 7-денний правило).
 */
export function resolveIsNewBadge(
  rawFlag: unknown,
  createdAt: string | null | undefined,
): boolean {
  if (rawFlag === true) return true;
  if (rawFlag === false) return false;
  return isNewByCreatedAt(createdAt);
}
