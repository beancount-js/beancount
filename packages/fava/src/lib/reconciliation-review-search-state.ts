import { fuzzySearch } from "@beancount-js/filters";
import type { ReconciliationReviewItem } from "@beancount-js/server";

export const RECONCILIATION_REVIEW_SEARCH_PARAM_KEYS = [
  "reconcileQ",
  "reconcileAccounts",
  "reconcileSources",
  "reconcileYears",
  "reconcileCurrency",
  "reconcileKinds",
  "reconcileConfidence",
] as const;

export type ReconciliationReviewSearchState = {
  query: string;
  accounts: string[];
  sources: string[];
  years: string[];
  currencies: string[];
  kinds: string[];
  confidence: string[];
};

export const DEFAULT_RECONCILIATION_REVIEW_SEARCH_STATE: ReconciliationReviewSearchState =
  {
    query: "",
    accounts: [],
    sources: [],
    years: [],
    currencies: [],
    kinds: [],
    confidence: [],
  };

type QueryParams = URLSearchParams | Record<string, string>;

export function normaliseReconciliationLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export function reconciliationKindLabel(value: string) {
  if (value === "overlap") return "Same Account Overlap";
  if (value === "existing") return "Already In Ledger";
  if (value === "transfer") return "Account Transfer";
  return normaliseReconciliationLabel(value);
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

function sourceLabel(item: ReconciliationReviewItem, memberIndex: number) {
  const member = item.members[memberIndex];
  if (!member) return "";
  return member.observation.origin === "ledger"
    ? "Existing ledger"
    : (member.observation.sourceId ?? "Incoming source");
}

function year(value: string): string | undefined {
  return value.length >= 4 ? value.slice(0, 4) : undefined;
}

function label(item: ReconciliationReviewItem, memberIndex: number) {
  const observation = item.members[memberIndex]?.observation;
  if (!observation) return "";
  return (
    observation.merchant ??
    observation.payee ??
    observation.narration ??
    observation.sourceAccount
  );
}

function candidateSearchDocument(item: ReconciliationReviewItem) {
  return {
    item,
    labels: item.members.map((_, index) => label(item, index)),
    accounts: item.members.map((member) => member.observation.sourceAccount),
    sources: item.members.map((_, index) => sourceLabel(item, index)),
    details: [
      item.candidate.kind,
      item.candidate.confidence,
      ...item.candidate.evidence.flatMap((evidence) => [
        evidence.kind,
        evidence.summary,
      ]),
      ...item.members.flatMap((member) => [
        member.observation.bookedAt,
        member.observation.amount,
        member.observation.currency,
      ]),
    ],
  };
}

function hasValue(values: readonly string[], value: string | undefined) {
  return !values.length || (value ? values.includes(value) : false);
}

function matchesFacets(
  item: ReconciliationReviewItem,
  state: ReconciliationReviewSearchState,
) {
  if (
    state.accounts.length &&
    !item.members.some((member) =>
      state.accounts.includes(member.observation.sourceAccount),
    )
  ) {
    return false;
  }
  if (
    state.sources.length &&
    !item.members.some((_, index) =>
      state.sources.includes(sourceLabel(item, index)),
    )
  ) {
    return false;
  }
  if (
    state.years.length &&
    !item.members.some((member) =>
      hasValue(state.years, year(member.observation.bookedAt)),
    )
  ) {
    return false;
  }
  if (
    state.currencies.length &&
    !item.members.some((member) =>
      state.currencies.includes(member.observation.currency),
    )
  ) {
    return false;
  }
  if (!hasValue(state.kinds, item.candidate.kind)) return false;
  return hasValue(state.confidence, item.candidate.confidence);
}

export function cloneReconciliationReviewSearchState(
  state: ReconciliationReviewSearchState = DEFAULT_RECONCILIATION_REVIEW_SEARCH_STATE,
): ReconciliationReviewSearchState {
  return {
    query: state.query,
    accounts: [...state.accounts],
    sources: [...state.sources],
    years: [...state.years],
    currencies: [...state.currencies],
    kinds: [...state.kinds],
    confidence: [...state.confidence],
  };
}

export function hasActiveReconciliationReviewSearch(
  state: ReconciliationReviewSearchState,
) {
  return (
    Boolean(state.query.trim()) ||
    state.accounts.length > 0 ||
    state.sources.length > 0 ||
    state.years.length > 0 ||
    state.currencies.length > 0 ||
    state.kinds.length > 0 ||
    state.confidence.length > 0
  );
}

export function parseReconciliationReviewSearchState(
  params: QueryParams,
): ReconciliationReviewSearchState {
  const get =
    params instanceof URLSearchParams
      ? (key: string) => params.get(key)
      : (key: string) => params[key] ?? null;
  return {
    query: get("reconcileQ")?.trim() ?? "",
    accounts: splitCsv(get("reconcileAccounts")),
    sources: splitCsv(get("reconcileSources")),
    years: splitCsv(get("reconcileYears")),
    currencies: splitCsv(get("reconcileCurrency")),
    kinds: splitCsv(get("reconcileKinds")),
    confidence: splitCsv(get("reconcileConfidence")),
  };
}

export function appendReconciliationReviewSearchParams(
  params: URLSearchParams,
  state: ReconciliationReviewSearchState,
) {
  for (const key of RECONCILIATION_REVIEW_SEARCH_PARAM_KEYS) {
    params.delete(key);
  }
  if (state.query.trim()) params.set("reconcileQ", state.query.trim());
  const accounts = joinCsv(state.accounts);
  if (accounts) params.set("reconcileAccounts", accounts);
  const sources = joinCsv(state.sources);
  if (sources) params.set("reconcileSources", sources);
  const years = joinCsv(state.years);
  if (years) params.set("reconcileYears", years);
  const currencies = joinCsv(state.currencies);
  if (currencies) params.set("reconcileCurrency", currencies);
  const kinds = joinCsv(state.kinds);
  if (kinds) params.set("reconcileKinds", kinds);
  const confidence = joinCsv(state.confidence);
  if (confidence) params.set("reconcileConfidence", confidence);
}

export function collectReconciliationReviewFacetOptions(
  items: readonly ReconciliationReviewItem[],
) {
  const accounts = new Set<string>();
  const sources = new Set<string>();
  const years = new Set<string>();
  const currencies = new Set<string>();
  const kinds = new Set<string>();
  const confidence = new Set<string>();
  for (const item of items) {
    kinds.add(item.candidate.kind);
    confidence.add(item.candidate.confidence);
    item.members.forEach((member, index) => {
      accounts.add(member.observation.sourceAccount);
      sources.add(sourceLabel(item, index));
      const bookedAtYear = year(member.observation.bookedAt);
      if (bookedAtYear) years.add(bookedAtYear);
      if (member.observation.currency)
        currencies.add(member.observation.currency);
    });
  }
  return {
    accounts: [...accounts].sort((left, right) => left.localeCompare(right)),
    sources: [...sources].sort((left, right) => left.localeCompare(right)),
    years: [...years].sort((left, right) => right.localeCompare(left)),
    currencies: [...currencies].sort((left, right) =>
      left.localeCompare(right),
    ),
    kinds: [...kinds].sort((left, right) => left.localeCompare(right)),
    confidence: [...confidence].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function filterReconciliationReviewSearch(
  items: readonly ReconciliationReviewItem[],
  state: ReconciliationReviewSearchState,
): ReconciliationReviewItem[] {
  const faceted = items.filter((item) => matchesFacets(item, state));
  if (!state.query.trim()) return faceted;
  return fuzzySearch(faceted.map(candidateSearchDocument), state.query, {
    keys: [
      { name: "labels", weight: 3 },
      { name: "accounts", weight: 2 },
      { name: "sources", weight: 2 },
      "details",
    ],
  }).map((document) => document.item);
}

export function paginateReconciliationReviewItems(
  items: readonly ReconciliationReviewItem[],
  size: number,
): ReconciliationReviewItem[][] {
  const result: ReconciliationReviewItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
