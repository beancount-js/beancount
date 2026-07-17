import { Transaction, type Directive } from "@beancount-js/beancount";
import type {
  CategorizationContext,
  CategorizerPlugin,
  CategorySuggestion,
  HistoricalSample,
  ImportProposal,
} from "./types";

export interface MerchantRule {
  merchant?: string;
  merchantId?: string;
  account: string;
  sourceAccount?: string;
  direction?: "debit" | "credit";
}

const precedence = { rule: 4, history: 3, recurring: 2, ai: 1, manual: 5 };

export const AUTO_READY_SCORE_THRESHOLD = 0.85;
export const AUTO_READY_SCORE_MARGIN = 0.1;

export function normalizeMerchant(input: string | undefined) {
  return (input ?? "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function direction(amount: string) {
  return amount.trim().startsWith("-") ? "debit" : "credit";
}

export function sortSuggestions(suggestions: readonly CategorySuggestion[]) {
  return [...suggestions].sort(
    (left, right) =>
      Number(Boolean(right.hard)) - Number(Boolean(left.hard)) ||
      suggestionScore(right) - suggestionScore(left) ||
      precedence[right.method] - precedence[left.method] ||
      left.account.localeCompare(right.account),
  );
}

/** A compatibility bridge while callers migrate away from `confidence`. */
export function suggestionScore(suggestion: CategorySuggestion) {
  return suggestion.rawScore ?? suggestion.confidence ?? 0;
}

/** Whether categorisation evidence is strong enough to skip manual review. */
export function suggestionsMeetAutoReadyThreshold(
  suggestions: readonly CategorySuggestion[],
) {
  const ordered = sortSuggestions(suggestions);
  if (ordered.some((suggestion) => suggestion.hard)) return true;
  const top = ordered[0];
  const next = ordered[1];
  if (!top || suggestionScore(top) < AUTO_READY_SCORE_THRESHOLD) return false;
  return !(
    next &&
    top.account !== next.account &&
    suggestionScore(top) - suggestionScore(next) < AUTO_READY_SCORE_MARGIN
  );
}

/** Whether a persisted proposal may be written without another review step. */
export function proposalIsReadyForAcceptance(
  proposal: Pick<ImportProposal, "selectedAccount" | "status" | "suggestions">,
) {
  if (proposal.status !== "ready" || !proposal.selectedAccount) return false;
  const selected = proposal.suggestions.filter(
    (suggestion) => suggestion.account === proposal.selectedAccount,
  );
  if (!selected.length) return false;
  if (selected.some((suggestion) => suggestion.hard)) return true;
  const ordered = sortSuggestions(proposal.suggestions);
  return (
    ordered[0]?.account === proposal.selectedAccount &&
    suggestionsMeetAutoReadyThreshold(ordered)
  );
}

function merchantLabel(context: CategorizationContext) {
  return (
    context.merchant?.canonicalName ??
    context.transaction.merchant ??
    context.transaction.payee ??
    context.transaction.narration
  );
}

export class MerchantRuleCategorizer implements CategorizerPlugin {
  readonly id = "merchant-rules";

  constructor(readonly rules: readonly MerchantRule[]) {}

  async suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]> {
    const merchant = normalizeMerchant(merchantLabel(context));
    const match = this.rules.find(
      (rule) =>
        ((rule.merchantId &&
          rule.merchantId === context.merchant?.merchantId) ||
          (!rule.merchantId &&
            Boolean(rule.merchant) &&
            normalizeMerchant(rule.merchant) === merchant)) &&
        (!rule.sourceAccount ||
          rule.sourceAccount === context.transaction.sourceAccount) &&
        (!rule.direction ||
          rule.direction === direction(context.transaction.amount)),
    );
    if (!match) return [];
    return [
      {
        account: match.account,
        rawScore: 1,
        scoreKind: "rule-certainty",
        support: 1,
        hard: true,
        method: "rule",
        explanation: `Categorised as ${match.account} by the merchant rule for ${merchantLabel(context)}.`,
        evidence: [
          {
            id: `rule:${match.merchantId ?? normalizeMerchant(match.merchant)}:${match.account}`,
            kind: "rule",
            summary: match.merchantId
              ? `Merchant rule for confirmed merchant ${match.merchantId}`
              : `Merchant rule for ${match.merchant}`,
          },
        ],
      },
    ];
  }
}

function matchingHistory(context: CategorizationContext) {
  const merchant = normalizeMerchant(merchantLabel(context));
  const txDirection = direction(context.transaction.amount);
  return context.history.filter(
    (sample) =>
      sample.sourceAccount === context.transaction.sourceAccount &&
      (context.merchant?.merchantId
        ? sample.merchantId === context.merchant.merchantId ||
          (!sample.merchantId &&
            normalizeMerchant(sample.merchant) === merchant)
        : normalizeMerchant(sample.merchant) === merchant) &&
      direction(sample.amount) === txDirection,
  );
}

export class HistoricalCategorizer implements CategorizerPlugin {
  readonly id = "ledger-history";

  async suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]> {
    const samples = matchingHistory(context);
    if (samples.length < 3) return [];
    const counts = new Map<string, number>();
    for (const sample of samples)
      counts.set(sample.category, (counts.get(sample.category) ?? 0) + 1);
    return sortSuggestions(
      [...counts.entries()].map(([account, occurrences]) => ({
        account,
        rawScore: occurrences / samples.length,
        scoreKind: "history-frequency" as const,
        support: occurrences,
        method: "history" as const,
        explanation: `Categorised as ${account} because ${merchantLabel(context)} has historically been posted there ${occurrences} time${occurrences === 1 ? "" : "s"}.`,
        evidence: [
          {
            id: `history:${context.merchant?.merchantId ?? normalizeMerchant(merchantLabel(context))}:${account}`,
            kind: "history" as const,
            summary: `${occurrences} matching historical posting${occurrences === 1 ? "" : "s"}`,
            occurrences,
          },
        ],
      })),
    );
  }
}

function cadenceFor(samples: readonly HistoricalSample[]) {
  if (samples.length < 3) return undefined;
  const dates = samples
    .map((sample) => Date.parse(`${sample.bookedAt}T00:00:00Z`))
    .sort((left, right) => left - right);
  const intervals = dates
    .slice(1)
    .map((date, index) => (date - dates[index]) / 86_400_000);
  const average =
    intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (
    intervals.every((value) => value >= 5 && value <= 9) &&
    average >= 5 &&
    average <= 9
  )
    return "weekly" as const;
  if (
    intervals.every((value) => value >= 25 && value <= 35) &&
    average >= 25 &&
    average <= 35
  )
    return "monthly" as const;
  if (
    intervals.every((value) => value >= 80 && value <= 100) &&
    average >= 80 &&
    average <= 100
  )
    return "quarterly" as const;
  if (
    intervals.every((value) => value >= 350 && value <= 380) &&
    average >= 350 &&
    average <= 380
  )
    return "yearly" as const;
  return undefined;
}

function sameAmount(left: string, right: string) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left === right;
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), 1) * 0.01;
}

export class RecurringCategorizer implements CategorizerPlugin {
  readonly id = "recurring";

  async suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]> {
    const samples = matchingHistory(context).filter((sample) =>
      sameAmount(sample.amount, context.transaction.amount),
    );
    const byAccount = new Map<string, HistoricalSample[]>();
    for (const sample of samples) {
      const group = byAccount.get(sample.category) ?? [];
      group.push(sample);
      byAccount.set(sample.category, group);
    }
    const suggestions: CategorySuggestion[] = [];
    for (const [account, group] of byAccount) {
      const cadence = cadenceFor(group);
      if (!cadence) continue;
      const occurrences = group.length;
      suggestions.push({
        account,
        rawScore: Math.min(0.95, 0.65 + occurrences * 0.05),
        scoreKind: "recurrence-strength",
        support: occurrences,
        method: "recurring",
        explanation: `Categorised as ${account} because this matches a ${cadence} recurring payment seen ${occurrences} times.`,
        evidence: [
          {
            id: `recurring:${context.merchant?.merchantId ?? normalizeMerchant(merchantLabel(context))}:${account}:${cadence}`,
            kind: "recurring",
            summary: `${cadence} recurring pattern`,
            occurrences,
            cadence,
          },
        ],
      });
    }
    return sortSuggestions(suggestions);
  }
}

/** Extract unambiguous, two-posting examples from the existing ledger. */
export function historySamplesFromEntries(
  entries: readonly Directive[],
): HistoricalSample[] {
  const samples: HistoricalSample[] = [];
  for (const entry of entries) {
    if (
      !(entry instanceof Transaction) ||
      entry.postings.length !== 2 ||
      !entry.date
    )
      continue;
    const [first, second] = entry.postings;
    if (!first.units && !second.units) continue;
    const source = first.units ? first : second;
    const category = source === first ? second : first;
    if (!source.units || !category.account) continue;
    samples.push({
      sourceAccount: source.account,
      merchant: entry.payee || entry.narration,
      merchantId:
        typeof entry.meta.merchant_id === "string"
          ? entry.meta.merchant_id
          : undefined,
      category: category.account,
      amount: source.units.value.toString(),
      bookedAt: entry.date.toISODate() ?? "",
    });
  }
  return samples;
}
