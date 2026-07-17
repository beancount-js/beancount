import { DateTime } from "luxon";
import { Decimal, md5 } from "@beancount-js/parser";
import type { NormalizedTransaction, TransferEvidence } from "./types";

export type ReconciliationObservationOrigin = "proposal" | "ledger";

/** A transaction-side record compared by the provider-neutral matcher. */
export interface ReconciliationObservation {
  /** Stable across review refreshes; proposal and ledger callers own this key. */
  id: string;
  origin: ReconciliationObservationOrigin;
  sourceId?: string;
  sourceAccount: string;
  bookedAt: string;
  amount: string;
  currency: string;
  merchant?: string;
  payee?: string;
  narration?: string;
  status?: "posted" | "pending";
  /** Any durable provider identities already represented by this observation. */
  importIds?: readonly string[];
  /** Optional raw payload fingerprint, if a provider supplies one. */
  rawFingerprint?: string;
  /** Higher values win when selecting a canonical new import. */
  priority?: number;
  transferEvidence?: TransferEvidence;
  transaction?: NormalizedTransaction;
}

export type ReconciliationCandidateKind = "overlap" | "existing" | "transfer";

export type ReconciliationConfidence = "high" | "possible";

export type ReconciliationEvidenceKind =
  | "same-account"
  | "opposite-amount"
  | "same-day"
  | "nearby-date"
  | "matching-label"
  | "matching-import-id"
  | "raw-fingerprint"
  | "provider-fx";

export interface ReconciliationEvidence {
  kind: ReconciliationEvidenceKind;
  summary: string;
}

export interface ReconciliationCandidate {
  id: string;
  kind: ReconciliationCandidateKind;
  memberIds: readonly string[];
  confidence: ReconciliationConfidence;
  evidence: readonly ReconciliationEvidence[];
  /** Omitted where equal-priority candidates need a reviewer choice. */
  recommendedCanonicalId?: string;
}

export interface ReconciliationOptions {
  duplicateWindowDays?: number;
  transferWindowDays?: number;
  fxRateTolerance?: number;
  /** Restrict transfer candidates to known balance-sheet/import accounts. */
  transferAccounts?: ReadonlySet<string>;
  /** Candidate ids previously rejected by the reviewer. */
  dismissedCandidateIds?: ReadonlySet<string>;
}

export interface ReconciliationResult {
  candidates: readonly ReconciliationCandidate[];
}

const DEFAULT_DUPLICATE_WINDOW_DAYS = 5;
const DEFAULT_TRANSFER_WINDOW_DAYS = 4;
const DEFAULT_FX_RATE_TOLERANCE = 0.02;

function normalizedText(value: string | undefined) {
  return (value ?? "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function labelsMatch(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  const leftLabel = normalizedText(
    left.merchant ?? left.payee ?? left.narration,
  );
  const rightLabel = normalizedText(
    right.merchant ?? right.payee ?? right.narration,
  );
  if (!leftLabel || !rightLabel) return false;
  if (leftLabel === rightLabel) return true;
  const leftWords = new Set(leftLabel.split(" "));
  const rightWords = new Set(rightLabel.split(" "));
  const common = [...leftWords].filter((word) => rightWords.has(word));
  return common.length >= 2;
}

function daysBetween(left: string, right: string) {
  const leftDate = DateTime.fromISO(left, { zone: "utc" });
  const rightDate = DateTime.fromISO(right, { zone: "utc" });
  if (!leftDate.isValid || !rightDate.isValid) return undefined;
  return Math.abs(Math.round(leftDate.diff(rightDate, "days").days));
}

function decimal(value: string) {
  try {
    return new Decimal(value);
  } catch {
    return undefined;
  }
}

function sameAmount(left: string, right: string) {
  const a = decimal(left);
  const b = decimal(right);
  return Boolean(a && b && a.eq(b));
}

function oppositeAmount(left: string, right: string) {
  const a = decimal(left);
  const b = decimal(right);
  return Boolean(a && b && a.eq(b.neg()));
}

function absoluteAmount(value: string) {
  const parsed = decimal(value);
  return parsed?.abs();
}

function sharesImportIdentity(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  const rightIds = new Set(right.importIds ?? []);
  return (left.importIds ?? []).some((id) => rightIds.has(id));
}

function hasRawFingerprintMatch(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  return Boolean(
    left.rawFingerprint &&
      right.rawFingerprint &&
      left.rawFingerprint === right.rawFingerprint,
  );
}

function candidateId(
  kind: ReconciliationCandidateKind,
  memberIds: readonly string[],
) {
  return `reconciliation:${md5([kind, ...[...memberIds].sort()].join("\0"))}`;
}

function candidateCanonicalId(members: readonly ReconciliationObservation[]) {
  const sorted = [...members].sort((left, right) => {
    const priority = (right.priority ?? 0) - (left.priority ?? 0);
    if (priority !== 0) return priority;
    const leftContent = contentScore(left);
    const rightContent = contentScore(right);
    if (leftContent !== rightContent) return rightContent - leftContent;
    return left.id.localeCompare(right.id);
  });
  const first = sorted[0];
  const second = sorted[1];
  if (!first) return undefined;
  if (
    second &&
    (first.priority ?? 0) === (second.priority ?? 0) &&
    contentScore(first) === contentScore(second) &&
    first.origin === "proposal" &&
    second.origin === "proposal"
  ) {
    return undefined;
  }
  return first.id;
}

function contentScore(observation: ReconciliationObservation) {
  return [
    observation.merchant,
    observation.payee,
    observation.narration,
    ...(observation.transaction?.tags ?? []),
    ...(observation.transaction?.links ?? []),
    ...Object.values(observation.transaction?.metadata ?? {}),
  ].filter((value) => Boolean(String(value).trim())).length;
}

function sameCurrencyTransfer(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  return (
    left.currency === right.currency &&
    oppositeAmount(left.amount, right.amount)
  );
}

function matchesEvidenceAmount(
  evidence: TransferEvidence | undefined,
  other: ReconciliationObservation,
) {
  if (!evidence?.sourceAmount) return false;
  return (
    evidence.sourceAmount.currency === other.currency &&
    sameAmount(
      evidence.sourceAmount.amount,
      absoluteAmount(other.amount)?.value ?? "",
    )
  );
}

function rateMatches(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
  tolerance: number,
) {
  const leftAmount = absoluteAmount(left.amount);
  const rightAmount = absoluteAmount(right.amount);
  if (!leftAmount || !rightAmount) return false;
  const implied = rightAmount.div(leftAmount);
  const rates = [
    left.transferEvidence?.exchangeRate,
    right.transferEvidence?.exchangeRate,
  ].filter((value): value is string => Boolean(value));
  return rates.some((rate) => {
    const parsed = decimal(rate);
    if (!parsed || parsed.zero) return false;
    const directDifference = implied.div(parsed).minus("1").abs();
    const inverseDifference = implied.mul(parsed).minus("1").abs();
    return (
      directDifference.lte(String(tolerance)) ||
      inverseDifference.lte(String(tolerance))
    );
  });
}

function providerBackedFxTransfer(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
  tolerance: number,
) {
  if (left.currency === right.currency || !oppositeAmountSign(left, right)) {
    return false;
  }
  return (
    matchesEvidenceAmount(left.transferEvidence, right) ||
    matchesEvidenceAmount(right.transferEvidence, left) ||
    rateMatches(left, right, tolerance)
  );
}

function oppositeAmountSign(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  const leftAmount = decimal(left.amount);
  const rightAmount = decimal(right.amount);
  if (!leftAmount || !rightAmount || leftAmount.zero || rightAmount.zero)
    return false;
  return (
    (leftAmount.gt("0") && rightAmount.lt("0")) ||
    (leftAmount.lt("0") && rightAmount.gt("0"))
  );
}

function addDateEvidence(evidence: ReconciliationEvidence[], days: number) {
  evidence.push(
    days === 0
      ? { kind: "same-day", summary: "Both records use the same booking date." }
      : {
          kind: "nearby-date",
          summary: `Booking dates are ${days} day${days === 1 ? "" : "s"} apart.`,
        },
  );
}

function isEligiblePair(
  left: ReconciliationObservation,
  right: ReconciliationObservation,
) {
  return (
    left.id !== right.id &&
    (left.origin === "proposal" || right.origin === "proposal")
  );
}

/**
 * Produce deterministic, review-only candidates. This function intentionally
 * never mutates transaction state or resolves an ambiguous match itself.
 */
export function findReconciliationCandidates(
  observations: readonly ReconciliationObservation[],
  options: ReconciliationOptions = {},
): ReconciliationResult {
  const duplicateWindowDays =
    options.duplicateWindowDays ?? DEFAULT_DUPLICATE_WINDOW_DAYS;
  const transferWindowDays =
    options.transferWindowDays ?? DEFAULT_TRANSFER_WINDOW_DAYS;
  const fxRateTolerance = options.fxRateTolerance ?? DEFAULT_FX_RATE_TOLERANCE;
  const dismissed = options.dismissedCandidateIds ?? new Set<string>();
  const candidates: ReconciliationCandidate[] = [];

  for (let leftIndex = 0; leftIndex < observations.length; leftIndex += 1) {
    const left = observations[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < observations.length;
      rightIndex += 1
    ) {
      const right = observations[rightIndex]!;
      if (!isEligiblePair(left, right)) continue;
      const days = daysBetween(left.bookedAt, right.bookedAt);
      if (days === undefined) continue;

      if (
        left.sourceAccount === right.sourceAccount &&
        left.currency === right.currency &&
        sameAmount(left.amount, right.amount) &&
        days <= duplicateWindowDays
      ) {
        const kind: ReconciliationCandidateKind =
          left.origin === "ledger" || right.origin === "ledger"
            ? "existing"
            : "overlap";
        const memberIds = [left.id, right.id];
        const id = candidateId(kind, memberIds);
        if (!dismissed.has(id)) {
          const evidence: ReconciliationEvidence[] = [
            {
              kind: "same-account",
              summary: "Both records affect the same account.",
            },
          ];
          addDateEvidence(evidence, days);
          if (sharesImportIdentity(left, right)) {
            evidence.push({
              kind: "matching-import-id",
              summary: "Both records carry the same provider import identity.",
            });
          }
          if (hasRawFingerprintMatch(left, right)) {
            evidence.push({
              kind: "raw-fingerprint",
              summary: "Both records carry the same raw provider fingerprint.",
            });
          }
          if (labelsMatch(left, right)) {
            evidence.push({
              kind: "matching-label",
              summary: "Merchant or narration labels agree.",
            });
          }
          candidates.push({
            id,
            kind,
            memberIds,
            confidence:
              days <= 1 ||
              labelsMatch(left, right) ||
              sharesImportIdentity(left, right)
                ? "high"
                : "possible",
            evidence,
            recommendedCanonicalId: candidateCanonicalId([left, right]),
          });
        }
      }

      const transferAccounts = options.transferAccounts;
      if (
        left.sourceAccount === right.sourceAccount ||
        (transferAccounts &&
          (!transferAccounts.has(left.sourceAccount) ||
            !transferAccounts.has(right.sourceAccount))) ||
        days > transferWindowDays
      ) {
        continue;
      }

      const sameCurrency = sameCurrencyTransfer(left, right);
      const providerFx = providerBackedFxTransfer(left, right, fxRateTolerance);
      if (!sameCurrency && !providerFx) continue;
      const memberIds = [left.id, right.id];
      const id = candidateId("transfer", memberIds);
      if (dismissed.has(id)) continue;
      const evidence: ReconciliationEvidence[] = [
        {
          kind: "opposite-amount",
          summary: sameCurrency
            ? "Amounts are exact opposites in the same currency."
            : "Amounts have opposite directions and provider FX evidence agrees.",
        },
      ];
      addDateEvidence(evidence, days);
      if (providerFx) {
        evidence.push({
          kind: "provider-fx",
          summary:
            "Provider-reported foreign-exchange amount or rate supports this pair.",
        });
      }
      if (labelsMatch(left, right)) {
        evidence.push({
          kind: "matching-label",
          summary: "Merchant or narration labels agree.",
        });
      }
      candidates.push({
        id,
        kind: "transfer",
        memberIds,
        confidence: days <= 1 || labelsMatch(left, right) ? "high" : "possible",
        evidence,
        recommendedCanonicalId: candidateCanonicalId([left, right]),
      });
    }
  }

  const membershipCount = new Map<string, number>();
  for (const candidate of candidates) {
    for (const memberId of candidate.memberIds) {
      membershipCount.set(memberId, (membershipCount.get(memberId) ?? 0) + 1);
    }
  }
  const resolved = candidates.map((candidate) => {
    const ambiguous = candidate.memberIds.some(
      (memberId) => (membershipCount.get(memberId) ?? 0) > 1,
    );
    return ambiguous && candidate.confidence === "high"
      ? { ...candidate, confidence: "possible" as const }
      : candidate;
  });
  return {
    candidates: resolved.sort((left, right) => left.id.localeCompare(right.id)),
  };
}
