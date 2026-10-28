import { fuzzySearch } from "@beancount-js/filters";

export type MerchantSearchable = {
  canonicalName: string;
  domain?: string;
  aliases?: readonly { normalizedValue: string }[];
};

type PathSearchable = { path: string };

const compareMerchants = <T extends MerchantSearchable>(left: T, right: T) =>
  left.canonicalName.localeCompare(right.canonicalName, undefined, {
    sensitivity: "base",
  });

/** Returns merchants in Fuse relevance order for standalone catalog searches. */
export function fuzzySearchMerchants<T extends MerchantSearchable>(
  merchants: readonly T[],
  query: string,
): T[] {
  return fuzzySearch(merchants, query, {
    keys: [
      { name: "canonicalName", weight: 3 },
      { name: "domain", weight: 2 },
      { name: "aliases.normalizedValue", weight: 2 },
    ],
  });
}

/**
 * Keeps explicit domain matches ahead of the typo-tolerant fallback used by
 * the local merchant matcher. Unmatched merchants remain available to pick.
 */
export function rankLocalMerchantMatches<T extends MerchantSearchable>(
  merchants: readonly T[],
  searchText: string,
  domain: string,
): T[] {
  const normalizedDomain = domain.trim().toLowerCase();
  const exact: T[] = [];
  const partial: T[] = [];
  const remaining: T[] = [];

  for (const merchant of merchants) {
    const merchantDomain = merchant.domain?.trim().toLowerCase() ?? "";
    if (normalizedDomain && merchantDomain === normalizedDomain) {
      exact.push(merchant);
    } else if (normalizedDomain && merchantDomain.includes(normalizedDomain)) {
      partial.push(merchant);
    } else {
      remaining.push(merchant);
    }
  }

  const rankGroup = (group: readonly T[]) => {
    if (!searchText.trim()) return [...group].sort(compareMerchants);
    const matches = fuzzySearchMerchants(group, searchText);
    const matched = new Set(matches);
    return [
      ...matches,
      ...group
        .filter((merchant) => !matched.has(merchant))
        .sort(compareMerchants),
    ];
  };

  return [...rankGroup(exact), ...rankGroup(partial), ...rankGroup(remaining)];
}

/** Fuzzy-rank path suggestions while retaining the caller's response limit. */
export function fuzzySearchPaths<T extends PathSearchable>(
  items: readonly T[],
  query: string,
  limit?: number,
): T[] {
  return fuzzySearch(items, query, {
    keys: [{ name: "path", weight: 3 }],
    limit,
  });
}
