import type { MerchantReviewCluster } from "@beancount-js/server";

export const INGESTION_MERCHANT_SEARCH_PARAM_KEYS = [
  "merchantQ",
  "merchantStatus",
  "merchantDomain",
] as const;

export type MerchantDomainFacet = "" | "has" | "missing";

export type IngestionMerchantSearchState = {
  query: string;
  statuses: string[];
  domain: MerchantDomainFacet;
};

export const DEFAULT_INGESTION_MERCHANT_SEARCH_STATE: IngestionMerchantSearchState =
  {
    query: "",
    statuses: [],
    domain: "",
  };

export const MERCHANT_CLUSTER_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suggested", label: "Suggested" },
  { value: "unresolved", label: "Unresolved" },
  { value: "suppressed", label: "Suppressed" },
] as const;

export const MERCHANT_DOMAIN_OPTIONS = [
  { value: "", label: "Any domain" },
  { value: "has", label: "Has domain" },
  { value: "missing", label: "Missing domain" },
] as const;

export function cloneIngestionMerchantSearchState(
  state: IngestionMerchantSearchState = DEFAULT_INGESTION_MERCHANT_SEARCH_STATE,
): IngestionMerchantSearchState {
  return {
    query: state.query,
    statuses: [...state.statuses],
    domain: state.domain,
  };
}

export function hasActiveIngestionMerchantSearch(
  state: IngestionMerchantSearchState,
) {
  return (
    Boolean(state.query.trim()) ||
    state.statuses.length > 0 ||
    Boolean(state.domain)
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

function isDomainFacet(value: string | null | undefined): MerchantDomainFacet {
  if (value === "has" || value === "missing") return value;
  return "";
}

export function parseIngestionMerchantSearchState(
  params: URLSearchParams | Record<string, string>,
): IngestionMerchantSearchState {
  const get =
    params instanceof URLSearchParams
      ? (key: string) => params.get(key)
      : (key: string) => params[key] ?? null;
  return {
    query: get("merchantQ")?.trim() ?? "",
    statuses: splitCsv(get("merchantStatus")),
    domain: isDomainFacet(get("merchantDomain")),
  };
}

export function appendIngestionMerchantSearchParams(
  params: URLSearchParams,
  state: IngestionMerchantSearchState,
) {
  for (const key of INGESTION_MERCHANT_SEARCH_PARAM_KEYS) params.delete(key);
  if (state.query.trim()) params.set("merchantQ", state.query.trim());
  const statuses = joinCsv(state.statuses);
  if (statuses) params.set("merchantStatus", statuses);
  if (state.domain) params.set("merchantDomain", state.domain);
}

function clusterSearchText(cluster: MerchantReviewCluster): string {
  const parts: string[] = [
    cluster.displayName,
    cluster.domain ?? "",
    cluster.explanation ?? "",
    ...cluster.statuses,
    ...cluster.members.map((member) => member.rawLabel),
    ...cluster.candidates.map((candidate) => candidate.canonicalName),
    ...cluster.candidates.flatMap((candidate) =>
      candidate.domain ? [candidate.domain] : [],
    ),
  ];
  return parts.join(" ").toLowerCase();
}

export function matchesIngestionMerchantSearch(
  cluster: MerchantReviewCluster,
  state: IngestionMerchantSearchState,
): boolean {
  const query = state.query.trim().toLowerCase();
  if (query && !clusterSearchText(cluster).includes(query)) return false;

  if (state.statuses.length) {
    const statuses = cluster.statuses as readonly string[];
    if (!state.statuses.some((status) => statuses.includes(status))) {
      return false;
    }
  }

  if (state.domain === "has" && !cluster.domain) return false;
  if (state.domain === "missing" && cluster.domain) return false;

  return true;
}
