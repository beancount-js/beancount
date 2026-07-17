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

/** A ranked Fuse match with the source item and its relevance score. */
export type FuzzySearchResult<T> = {
  item: T;
  /** Lower scores are more relevant. Empty-query browse results use zero. */
  score: number;
  /** The item's position in the original collection. */
  refIndex: number;
};

/**
 * Search structured records using Fuse's typo-tolerant ranking and retain
 * relevance scores for callers that need to filter without replacing an
 * existing presentation sort.
 */
export function fuzzySearchWithScores<T extends object>(
  items: readonly T[],
  query: string,
  { keys, threshold = 0.35, limit }: FuzzySearchOptions,
): FuzzySearchResult<T>[] {
  const needle = query.trim();
  if (!needle) {
    return items.slice(0, limit).map((item, refIndex) => ({
      item,
      score: 0,
      refIndex,
    }));
  }

  const fuse = new Fuse([...items], {
    keys: [...keys],
    threshold,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 1,
  });
  return fuse
    .search(needle, limit === undefined ? undefined : { limit })
    .map((result) => ({
      item: result.item,
      score: result.score ?? 1,
      refIndex: result.refIndex,
    }));
}

/**
 * Search structured records using Fuse's typo-tolerant ranking. Empty queries
 * preserve the source order so callers can use this for both browse and search
 * states without special cases.
 */
export function fuzzySearch<T extends object>(
  items: readonly T[],
  query: string,
  options: FuzzySearchOptions,
): T[] {
  return fuzzySearchWithScores(items, query, options).map(
    (result) => result.item,
  );
}
