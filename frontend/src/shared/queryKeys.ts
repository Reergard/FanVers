/** Єдине джерело ключів React Query для профілю поточного користувача. */
export const PROFILE_QUERY_ROOT = "profile" as const;

export function profileQueryKey(
  userId: number | string | null | undefined,
): readonly [typeof PROFILE_QUERY_ROOT, number | string | null] {
  return [PROFILE_QUERY_ROOT, userId ?? null] as const;
}
