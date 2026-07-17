import type { ImportProposal } from "../ingestion/types";
import { fuzzySearch } from "@beancount-js/filters";

export const INGESTION_REVIEW_SEARCH_PARAM_KEYS = [
  "reviewQ",
  "reviewAccounts",
  "reviewMerchant",
  "reviewYears",
  "reviewCurrency",
] as const;

export type IngestionReviewSearchState = {
  query: string;
  accounts: string[];
  merchantStatuses: string[];
  years: string[];
  currencies: string[];
};

export const DEFAULT_INGESTION_REVIEW_SEARCH_STATE: IngestionReviewSearchState =
  {
    query: "",
    accounts: [],
    merchantStatuses: [],
    years: [],
    currencies: [],
  };

export const MERCHANT_RESOLUTION_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suggested", label: "Suggested" },
  { value: "unresolved", label: "Unresolved" },
  { value: "suppressed", label: "Suppressed" },
] as const;

export function cloneIngestionReviewSearchState(
  state: IngestionReviewSearchState = DEFAULT_INGESTION_REVIEW_SEARCH_STATE,
): IngestionReviewSearchState {
  return {
    query: state.query,
    accounts: [...state.accounts],
    merchantStatuses: [...state.merchantStatuses],
    years: [...state.years],
    currencies: [...state.currencies],
  };
}

export function hasActiveIngestionReviewSearch(
  state: IngestionReviewSearchState,
) {
  return (
    Boolean(state.query.trim()) ||
    state.accounts.length > 0 ||
    state.merchantStatuses.length > 0 ||
    state.years.length > 0 ||
    state.currencies.length > 0
  );
}

function splitCsv(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinCsv(values: readonly string[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

export function parseIngestionReviewSearchState(
  params: URLSearchParams | Record<string, string>,
): IngestionReviewSearchState {
  const get =
    params instanceof URLSearchParams
      ? (key: string) => params.get(key)
      : (key: string) => params[key] ?? null;
  return {
    query: get("reviewQ")?.trim() ?? "",
    accounts: splitCsv(get("reviewAccounts")),
    merchantStatuses: splitCsv(get("reviewMerchant")),
    years: splitCsv(get("reviewYears")),
    currencies: splitCsv(get("reviewCurrency")),
  };
}

export function appendIngestionReviewSearchParams(
  params: URLSearchParams,
  state: IngestionReviewSearchState,
) {
  for (const key of INGESTION_REVIEW_SEARCH_PARAM_KEYS) params.delete(key);
  if (state.query.trim()) params.set("reviewQ", state.query.trim());
  const accounts = joinCsv(state.accounts);
  if (accounts) params.set("reviewAccounts", accounts);
  const merchant = joinCsv(state.merchantStatuses);
  if (merchant) params.set("reviewMerchant", merchant);
  const years = joinCsv(state.years);
  if (years) params.set("reviewYears", years);
  const currencies = joinCsv(state.currencies);
  if (currencies) params.set("reviewCurrency", currencies);
}

function proposalSearchDocument(proposal: ImportProposal) {
  const accounts = proposalAccounts(proposal);
  const merchants = [
    proposal.transaction?.merchant ?? "",
    proposal.transaction?.payee ?? "",
    proposal.transaction?.narration ?? "",
  ];
  const details = [
    proposal.status,
    ...proposal.issues,
    proposal.transaction?.amount ?? "",
    proposal.transaction?.currency ?? "",
  ];
  const resolution = proposal.merchantResolution;
  if (resolution) {
    details.push(resolution.status);
    if ("rawLabel" in resolution && resolution.rawLabel) {
      merchants.push(resolution.rawLabel);
    }
    if (resolution.status === "confirmed") {
      merchants.push(resolution.merchant.canonicalName);
      if (resolution.merchant.domain)
        merchants.push(resolution.merchant.domain);
    } else if (resolution.status === "suggested") {
      for (const candidate of resolution.candidates) {
        merchants.push(candidate.canonicalName);
        if (candidate.domain) merchants.push(candidate.domain);
      }
    }
  }
  return { proposal, accounts, merchants, details };
}

function proposalAccounts(proposal: ImportProposal): string[] {
  const values = new Set<string>();
  if (proposal.selectedAccount) values.add(proposal.selectedAccount);
  for (const suggestion of proposal.suggestions) {
    if (suggestion.account) values.add(suggestion.account);
  }
  return [...values];
}

function proposalMerchantStatus(proposal: ImportProposal): string {
  return proposal.merchantResolution?.status ?? "unresolved";
}

function proposalYear(proposal: ImportProposal): string | undefined {
  const bookedAt = proposal.transaction?.bookedAt;
  if (!bookedAt || bookedAt.length < 4) return undefined;
  return bookedAt.slice(0, 4);
}

export function collectIngestionReviewFacetOptions(
  proposals: readonly ImportProposal[],
) {
  const accounts = new Set<string>();
  const years = new Set<string>();
  const currencies = new Set<string>();
  for (const proposal of proposals) {
    for (const account of proposalAccounts(proposal)) accounts.add(account);
    const year = proposalYear(proposal);
    if (year) years.add(year);
    const currency = proposal.transaction?.currency?.trim();
    if (currency) currencies.add(currency);
  }
  return {
    accounts: [...accounts].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
    years: [...years].sort((a, b) => b.localeCompare(a)),
    currencies: [...currencies].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
  };
}

function matchesIngestionReviewFacets(
  proposal: ImportProposal,
  state: IngestionReviewSearchState,
): boolean {
  if (state.accounts.length) {
    const accounts = proposalAccounts(proposal);
    if (!state.accounts.some((account) => accounts.includes(account))) {
      return false;
    }
  }

  if (
    state.merchantStatuses.length &&
    !state.merchantStatuses.includes(proposalMerchantStatus(proposal))
  ) {
    return false;
  }

  if (state.years.length) {
    const year = proposalYear(proposal);
    if (!year || !state.years.includes(year)) return false;
  }

  if (state.currencies.length) {
    const currency = proposal.transaction?.currency;
    if (!currency || !state.currencies.includes(currency)) return false;
  }

  return true;
}

/**
 * Filters exact facets first, then uses Fuse for free-text matching. Callers
 * may retain their own table sorting by consuming the result as a match set.
 */
export function filterIngestionReviewSearch(
  proposals: readonly ImportProposal[],
  state: IngestionReviewSearchState,
): ImportProposal[] {
  const faceted = proposals.filter((proposal) =>
    matchesIngestionReviewFacets(proposal, state),
  );
  if (!state.query.trim()) return faceted;

  return fuzzySearch(faceted.map(proposalSearchDocument), state.query, {
    keys: [
      { name: "merchants", weight: 3 },
      { name: "accounts", weight: 2 },
      "details",
    ],
  }).map((document) => document.proposal);
}

export function matchesIngestionReviewSearch(
  proposal: ImportProposal,
  state: IngestionReviewSearchState,
): boolean {
  return filterIngestionReviewSearch([proposal], state).length > 0;
}
