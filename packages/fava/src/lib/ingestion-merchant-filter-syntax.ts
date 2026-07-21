import type { MerchantReviewCluster } from "@beancount-js/server";
import type {
  SearchFilterSyntax,
  SearchFilterValue,
} from "@beancount-js/ui/forms";
import { MERCHANT_CLUSTER_STATUS_OPTIONS } from "./ingestion-merchant-search-state";

const TEXT_OPERATORS = [":", "=", "!=", ">", ">=", "<", "<=", "~", "!~"];
const NUMBER_OPERATORS = [":", "=", "!=", ">", ">=", "<", "<=", "~", "!~"];

function quoteFilterValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (!/[\s"'#^()[\],=<>!~/\\]/.test(trimmed)) return trimmed;
  return `"${trimmed.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function valuesFrom(items: Iterable<string | undefined>): SearchFilterValue[] {
  const values = new Map<string, SearchFilterValue>();
  for (const item of items) {
    const value = item?.trim();
    if (!value || values.has(value.toLocaleLowerCase())) continue;
    values.set(value.toLocaleLowerCase(), {
      value,
      apply: quoteFilterValue(value),
    });
  }
  return [...values.values()];
}

/** The discoverable query syntax supported by MerchantReviewFilter. */
export function merchantReviewFilterSyntax(
  clusters: readonly MerchantReviewCluster[],
): SearchFilterSyntax {
  const statuses = valuesFrom([
    ...MERCHANT_CLUSTER_STATUS_OPTIONS.map((option) => option.value),
    ...clusters.flatMap((cluster) => cluster.statuses),
  ]);
  const domains = valuesFrom(clusters.map((cluster) => cluster.domain));
  const accounts = valuesFrom(
    clusters.flatMap((cluster) =>
      cluster.transactions.map((transaction) => transaction.sourceAccount),
    ),
  );
  const currencies = valuesFrom(
    clusters.flatMap((cluster) =>
      cluster.transactions.map((transaction) => transaction.currency),
    ),
  );
  const merchants = valuesFrom(clusters.map((cluster) => cluster.displayName));
  const candidates = valuesFrom(
    clusters.flatMap((cluster) =>
      cluster.candidates.map((candidate) => candidate.canonicalName),
    ),
  );

  return {
    description:
      "Select a field, comparison, and value. Plain words still use merchant text search.",
    fields: [
      {
        name: "confidence",
        description: "Best AI candidate score.",
        aliases: ["ai.confidence", "score"],
        operators: NUMBER_OPERATORS,
      },
      {
        name: "pending",
        description: "Pending transaction count.",
        aliases: ["pendingCount", "pending_count", "count"],
        operators: NUMBER_OPERATORS,
      },
      {
        name: "merchant",
        description: "Cluster display name.",
        aliases: ["name", "displayName", "display_name"],
        operators: TEXT_OPERATORS,
        values: merchants,
      },
      {
        name: "domain",
        description: "Merchant or candidate domain.",
        operators: TEXT_OPERATORS,
        values: domains,
      },
      {
        name: "status",
        description: "Merchant resolution status.",
        aliases: ["statuses"],
        operators: TEXT_OPERATORS,
        values: statuses,
      },
      {
        name: "label",
        description: "Raw or normalized source label.",
        aliases: ["labels", "rawLabel", "raw_label"],
        operators: TEXT_OPERATORS,
      },
      {
        name: "candidate",
        description: "AI candidate name or domain.",
        aliases: ["candidates"],
        operators: TEXT_OPERATORS,
        values: candidates,
      },
      {
        name: "account",
        description: "Transaction source account.",
        operators: TEXT_OPERATORS,
        values: accounts,
      },
      {
        name: "currency",
        description: "Transaction currency.",
        operators: TEXT_OPERATORS,
        values: currencies,
      },
      {
        name: "amount",
        description: "Absolute transaction amount.",
        operators: NUMBER_OPERATORS,
      },
      {
        name: "payee",
        description: "Transaction payee.",
        operators: TEXT_OPERATORS,
      },
      {
        name: "narration",
        description: "Transaction narration.",
        operators: TEXT_OPERATORS,
      },
      {
        name: "run",
        description: "Ingestion run ID.",
        aliases: ["runId", "run_id"],
        operators: TEXT_OPERATORS,
      },
      {
        name: "explanation",
        description: "Merchant-resolution explanation.",
        operators: TEXT_OPERATORS,
      },
      {
        name: "id",
        description: "Merchant cluster ID.",
        operators: TEXT_OPERATORS,
      },
    ],
    examples: [
      {
        query: "confidence >= 0.9",
        description: "High-confidence suggestions.",
      },
      {
        query: "status: unresolved",
        description: "Clusters that still need review.",
      },
      {
        query: "account: Assets:Checking:Monzo currency: GBP",
        description: "A source account and currency together.",
      },
    ],
    notes: [
      "Separate terms with a space to require both; use OR, parentheses, or a leading - to change that logic.",
      "Aliases remain valid but completions prefer the canonical field names shown here.",
    ],
  };
}
