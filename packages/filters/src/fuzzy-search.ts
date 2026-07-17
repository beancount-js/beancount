import Fuse from "fuse.js";

export type FuzzySearchKey =
  | string
  | {
      name: string | string[];
      weight?: number;
    };

export type FuzzySearchOptions = {
  /** Fields to search, ordered or weighted by their importance. */
  keys: readonly FuzzySearchKey[];
  /** Lower values require a closer match. Defaults to a forgiving 0.35. */
  threshold?: number;
  /** Limit the number of ranked results returned. */
  limit?: number;
};

/**
 * Search structured records using Fuse's typo-tolerant ranking. Empty queries
 * preserve the source order so callers can use this for both browse and search
 * states without special cases.
 */
export function fuzzySearch<T extends object>(
  items: readonly T[],
  query: string,
  { keys, threshold = 0.35, limit }: FuzzySearchOptions,
): T[] {
  const needle = query.trim();
  if (!needle) return [...items];

  const fuse = new Fuse([...items], {
    keys: [...keys],
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
  return fuse
    .search(needle, limit === undefined ? undefined : { limit })
    .map((result) => result.item);
}
