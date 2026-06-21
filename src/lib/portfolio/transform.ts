import type { PortfolioItem } from "./schema";

/** Distinct categories across all entries, sorted for stable autocomplete. */
export function collectCategories(items: PortfolioItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const category of item.categories) {
      const trimmed = category.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * True when `order` is a complete permutation of `0..length-1` (every index once).
 * The client builds reorder payloads from this shape; checking it before a commit
 * means a buggy drag can never drop or duplicate an entry.
 */
export function isPermutation(order: number[], length: number): boolean {
  if (order.length !== length) return false;
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= length || seen.has(i)) return false;
    seen.add(i);
  }
  return true;
}
