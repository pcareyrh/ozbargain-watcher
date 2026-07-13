import type { Deal } from "../ozbargain/types";

/**
 * Empty allowlist means all categories (no filtering).
 * Non-empty: keep deals whose categorySlug is in the allowlist.
 * Deals with a missing categorySlug are dropped when filtering is active.
 */
export function filterByCategory(
  deals: Deal[],
  allowlist: string[],
): Deal[] {
  if (allowlist.length === 0) return deals;

  const allowed = new Set(allowlist.map((s) => s.toLowerCase()));
  return deals.filter(
    (deal) =>
      deal.categorySlug !== null && allowed.has(deal.categorySlug.toLowerCase()),
  );
}
