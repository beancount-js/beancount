import type { MerchantReviewCluster } from "@beancount-js/server";
import {
  AbstractFilterVisitor,
  AccountFilter,
  BooleanFilter,
  DateFilter,
  FieldFilter,
  FilterType,
  LinkFilter,
  NumberFilter,
  PatternFilter,
  TagFilter,
  TextFilter,
  fuzzySearch,
  parseQuery,
  type VisitorContext,
} from "@beancount-js/filters";

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

type MerchantFilterEntity = MerchantReviewCluster | string | number;

function isMerchantCluster(
  entity: MerchantFilterEntity,
): entity is MerchantReviewCluster {
  return typeof entity === "object";
}

function testPattern(pattern: RegExp, value: string) {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function compareNumber(actual: number, expected: number, op: string) {
  switch (op) {
    case "!=":
      return actual !== expected;
    case ">":
      return actual > expected;
    case ">=":
      return actual >= expected;
    case "<":
      return actual < expected;
    case "<=":
      return actual <= expected;
    case "~":
      return Math.abs(actual) === Math.abs(expected);
    case "!~":
      return Math.abs(actual) !== Math.abs(expected);
    case ":":
    case "=":
    default:
      return actual === expected;
  }
}

function compareText(actual: string, expected: TextFilter, op: string) {
  const left = actual.toLocaleLowerCase();
  const right = expected.value.toLocaleLowerCase();
  switch (op) {
    case "!=":
      return left !== right;
    case ">":
      return actual > expected.value;
    case ">=":
      return actual >= expected.value;
    case "<":
      return actual < expected.value;
    case "<=":
      return actual <= expected.value;
    case "~":
      return testPattern(expected.pattern().value, actual);
    case "!~":
      return !testPattern(expected.pattern().value, actual);
    case "=":
      return left === right;
    case ":":
    default:
      return (
        left.includes(right) || testPattern(expected.pattern().value, actual)
      );
  }
}

/** The best finite AI candidate score is the confidence shown in review rows. */
export function merchantClusterConfidence(cluster: MerchantReviewCluster) {
  const scores = cluster.candidates
    .map((candidate) => candidate.rawScore)
    .filter(
      (score): score is number =>
        typeof score === "number" && Number.isFinite(score),
    );
  return scores.length ? Math.max(...scores) : undefined;
}

function merchantSearchValues(cluster: MerchantReviewCluster): string[] {
  return [
    cluster.displayName,
    cluster.domain ?? "",
    cluster.id,
    cluster.explanation ?? "",
    ...cluster.statuses,
    ...cluster.members.flatMap((member) => [
      member.rawLabel,
      member.normalizedLabel,
    ]),
    ...cluster.candidates.flatMap((candidate) => [
      candidate.canonicalName,
      candidate.domain ?? "",
    ]),
    ...cluster.transactions.flatMap((transaction) => [
      transaction.payee ?? "",
      transaction.narration,
      transaction.rawLabel,
      transaction.sourceAccount,
      transaction.currency,
      transaction.runId,
    ]),
  ].filter(Boolean);
}

function fieldValues(
  cluster: MerchantReviewCluster,
  field: string,
): MerchantFilterEntity[] {
  switch (field.trim().toLocaleLowerCase()) {
    case "confidence":
    case "ai.confidence":
    case "score": {
      const confidence = merchantClusterConfidence(cluster);
      return confidence === undefined ? [] : [confidence];
    }
    case "pending":
    case "pendingcount":
    case "pending_count":
    case "count":
      return [cluster.pendingCount];
    case "merchant":
    case "name":
    case "displayname":
    case "display_name":
      return [cluster.displayName];
    case "domain":
      return cluster.domain ? [cluster.domain] : [];
    case "status":
    case "statuses":
      return [...cluster.statuses];
    case "label":
    case "labels":
    case "rawlabel":
    case "raw_label":
      return cluster.members.flatMap((member) => [
        member.rawLabel,
        member.normalizedLabel,
      ]);
    case "candidate":
    case "candidates":
      return cluster.candidates.flatMap((candidate) => [
        candidate.canonicalName,
        candidate.domain ?? "",
      ]);
    case "account":
      return cluster.transactions.map(
        (transaction) => transaction.sourceAccount,
      );
    case "currency":
      return cluster.transactions.map((transaction) => transaction.currency);
    case "amount":
      return cluster.transactions.flatMap((transaction) => {
        const amount = Number(transaction.amount);
        return Number.isFinite(amount) ? [Math.abs(amount)] : [];
      });
    case "payee":
      return cluster.transactions.flatMap((transaction) =>
        transaction.payee ? [transaction.payee] : [],
      );
    case "narration":
      return cluster.transactions.map((transaction) => transaction.narration);
    case "run":
    case "runid":
    case "run_id":
      return cluster.transactions.map((transaction) => transaction.runId);
    case "explanation":
      return cluster.explanation ? [cluster.explanation] : [];
    case "id":
      return [cluster.id];
    default:
      return [];
  }
}

/** Applies the shared Fava filter AST to merchant-review cluster values. */
class MerchantReviewFilter extends AbstractFilterVisitor<MerchantFilterEntity> {
  visitTagFilter(
    _filter: TagFilter,
    _entity: MerchantFilterEntity,
    _context: VisitorContext,
  ) {
    return false;
  }

  visitLinkFilter(
    _filter: LinkFilter,
    _entity: MerchantFilterEntity,
    _context: VisitorContext,
  ) {
    return false;
  }

  visitNumberFilter(
    filter: NumberFilter,
    entity: MerchantFilterEntity,
    context: VisitorContext,
  ) {
    const expected = Number(filter.value);
    if (!Number.isFinite(expected)) return false;
    const values = isMerchantCluster(entity)
      ? [merchantClusterConfidence(entity), entity.pendingCount].filter(
          (value): value is number => value !== undefined,
        )
      : typeof entity === "number"
        ? [entity]
        : [Number(entity)].filter(Number.isFinite);
    return values.some((value) => compareNumber(value, expected, context.op));
  }

  visitTextFilter(
    filter: TextFilter,
    entity: MerchantFilterEntity,
    context: VisitorContext,
  ) {
    const values = isMerchantCluster(entity)
      ? merchantSearchValues(entity)
      : [String(entity)];
    return values.some((value) => compareText(value, filter, context.op));
  }

  visitPatternFilter(
    filter: PatternFilter,
    entity: MerchantFilterEntity,
    _context: VisitorContext,
  ) {
    const values = isMerchantCluster(entity)
      ? merchantSearchValues(entity)
      : [String(entity)];
    return values.some((value) => testPattern(filter.value, value));
  }

  visitAccountFilter(
    filter: AccountFilter,
    entity: MerchantFilterEntity,
    context: VisitorContext,
  ) {
    if (!isMerchantCluster(entity)) {
      return this.visitTextFilter(TextFilter.of(filter.value), entity, context);
    }
    return entity.transactions.some((transaction) =>
      this.visitTextFilter(
        TextFilter.of(filter.value),
        transaction.sourceAccount,
        context,
      ),
    );
  }

  visitFieldFilter(
    filter: FieldFilter,
    entity: MerchantFilterEntity,
    _context: VisitorContext,
  ) {
    if (!isMerchantCluster(entity)) return false;
    return fieldValues(entity, filter.field).some((value) =>
      filter.value.accept(this, value, { op: filter.op }),
    );
  }

  visitDateFilter(
    _filter: DateFilter,
    _entity: MerchantFilterEntity,
    _context: VisitorContext,
  ) {
    return false;
  }

  visitBooleanFilter(
    filter: BooleanFilter,
    entity: MerchantFilterEntity,
    context: VisitorContext,
  ) {
    if (!filter.args.length) return true;
    if (filter.op === FilterType.AND) {
      return filter.args.every((item) => item.accept(this, entity, context));
    }
    if (filter.op === FilterType.OR) {
      return filter.args.some((item) => item.accept(this, entity, context));
    }
    return !filter.args.some((item) => item.accept(this, entity, context));
  }
}

const merchantReviewFilter = new MerchantReviewFilter();

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

function clusterSearchDocument(cluster: MerchantReviewCluster) {
  return {
    cluster,
    merchant: merchantSearchValues(cluster),
    details: [cluster.explanation ?? "", ...cluster.statuses],
  };
}

function matchesIngestionMerchantFacets(
  cluster: MerchantReviewCluster,
  state: IngestionMerchantSearchState,
): boolean {
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

function isPlainMerchantTextQuery(query: string) {
  return !/[():<>=!~,]/.test(query) && !/\b(?:and|or|not)\b/i.test(query);
}

/** Exact facets narrow candidates before the shared filter-query parser runs. */
export function filterIngestionMerchantSearch(
  clusters: readonly MerchantReviewCluster[],
  state: IngestionMerchantSearchState,
): MerchantReviewCluster[] {
  const faceted = clusters.filter((cluster) =>
    matchesIngestionMerchantFacets(cluster, state),
  );
  if (!state.query.trim()) return faceted;

  if (isPlainMerchantTextQuery(state.query)) {
    return fuzzySearch(faceted.map(clusterSearchDocument), state.query, {
      keys: [{ name: "merchant", weight: 3 }, "details"],
    }).map((document) => document.cluster);
  }

  const [filter, errors] = parseQuery(state.query);
  if (!errors.length) {
    return faceted.filter((cluster) =>
      filter.accept(merchantReviewFilter, cluster, { op: ":" }),
    );
  }

  return faceted;
}

export function matchesIngestionMerchantSearch(
  cluster: MerchantReviewCluster,
  state: IngestionMerchantSearchState,
): boolean {
  return filterIngestionMerchantSearch([cluster], state).length > 0;
}
