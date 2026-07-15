import { md5 } from "@beancount-js/parser";
import {
  normalizeMerchant,
  sortSuggestions,
  suggestionScore,
} from "./categorize";
import type {
  CategorySuggestion,
  ImportProposal,
  IngestionRequest,
  IngestionRun,
  MerchantResolution,
  NormalizedTransaction,
} from "./types";

export function transactionFingerprint(transaction: NormalizedTransaction) {
  return md5(
    [
      transaction.sourceAccount,
      transaction.bookedAt,
      transaction.amount,
      transaction.currency,
      transaction.merchant ?? transaction.payee ?? transaction.narration,
    ]
      .join("\u0000")
      .trim(),
  );
}

export function importIdentity(transaction: NormalizedTransaction) {
  return transaction.externalId
    ? `${transaction.sourceId}:${transaction.externalId}`
    : `${transaction.sourceId}:fingerprint:${transactionFingerprint(transaction)}`;
}

function statusSummary(proposals: readonly ImportProposal[]) {
  return {
    total: proposals.length,
    ready: proposals.filter((proposal) => proposal.status === "ready").length,
    needsReview: proposals.filter(
      (proposal) => proposal.status === "needs-review",
    ).length,
    duplicates: proposals.filter((proposal) => proposal.status === "duplicate")
      .length,
    invalid: proposals.filter((proposal) => proposal.status === "invalid")
      .length,
    held: proposals.filter((proposal) => proposal.status === "held").length,
  };
}

function proposalForInvalid(
  id: string,
  importId: string,
  issue: string,
): ImportProposal {
  return {
    id,
    importId,
    suggestions: [],
    status: "invalid",
    issues: [issue],
  };
}

function shouldAskAi(suggestions: readonly CategorySuggestion[]) {
  const ordered = sortSuggestions(suggestions);
  if (ordered.some((suggestion) => suggestion.hard)) return false;
  const top = ordered[0];
  const next = ordered[1];
  if (!top) return true;
  if (suggestionScore(top) < 0.85) return true;
  return Boolean(
    next &&
      top.account !== next.account &&
      suggestionScore(top) - suggestionScore(next) < 0.1,
  );
}

function merchantLabel(transaction: NormalizedTransaction) {
  return transaction.merchant ?? transaction.payee ?? transaction.narration;
}

function initialMerchantResolution(
  transaction: NormalizedTransaction,
): MerchantResolution {
  const rawLabel = merchantLabel(transaction);
  return rawLabel
    ? {
        status: "unresolved",
        rawLabel,
        explanation: "No confirmed merchant profile matched this transaction.",
      }
    : { status: "unresolved", explanation: "No merchant label was supplied." };
}

function mergeMerchantResolution(
  current: MerchantResolution,
  next: MerchantResolution,
): MerchantResolution {
  if (current.status !== "suggested" || next.status !== "suggested")
    return next;
  return {
    ...next,
    candidates: [
      ...next.candidates,
      ...current.candidates.filter(
        (candidate) =>
          !next.candidates.some(
            (nextCandidate) => nextCandidate.id === candidate.id,
          ),
      ),
    ],
  };
}

async function resolveMerchant<Config, Record>(
  request: IngestionRequest<Config, Record>,
  transaction: NormalizedTransaction,
) {
  let resolution = initialMerchantResolution(transaction);
  const issues: string[] = [];
  for (const resolver of request.merchantResolvers ?? []) {
    if (resolution.status === "confirmed" || resolution.status === "suppressed")
      break;
    try {
      const next = await resolver.resolve({ transaction, resolution });
      if (next) resolution = mergeMerchantResolution(resolution, next);
    } catch {
      issues.push(
        `Merchant resolver ${resolver.id} was unavailable; review merchant details manually.`,
      );
    }
  }
  return { resolution, issues };
}

export async function runIngestion<Config, Record>(
  request: IngestionRequest<Config, Record>,
): Promise<IngestionRun> {
  const startedAt = request.fetchedAt ?? new Date().toISOString();
  const proposals: ImportProposal[] = [];
  const importIds = new Set(request.existingImportIds ?? []);
  const fingerprints = new Set(request.existingFingerprints ?? []);
  const knownProposalIds = new Set<string>();
  const merchantResolutions = new Map<
    string,
    Promise<{ resolution: MerchantResolution; issues: string[] }>
  >();
  let cursor = request.cursor;
  let row = 0;

  for await (const page of request.source.read(request.sourceConfig, {
    sourceId: request.sourceId,
    cursor,
    ...request.sourceContext,
  })) {
    cursor = page.nextCursor;
    for (const record of page.records) {
      row += 1;
      const normalized = request.normalizer.normalize(record, {
        sourceId: request.sourceId,
        sourceAccount: request.sourceAccount,
        defaultCurrency: request.defaultCurrency,
        fetchedAt: startedAt,
      });
      if (!normalized.ok) {
        proposals.push(
          proposalForInvalid(
            `invalid:${row}`,
            `invalid:${row}`,
            normalized.message,
          ),
        );
        continue;
      }

      const transaction = normalized.transaction;
      const importId = importIdentity(transaction);
      const fingerprint = transactionFingerprint(transaction);
      const proposalId = `proposal:${md5(importId)}`;
      if (
        importIds.has(importId) ||
        knownProposalIds.has(proposalId) ||
        fingerprints.has(fingerprint)
      ) {
        proposals.push({
          id: proposalId,
          importId,
          transaction,
          suggestions: [],
          status: "duplicate",
          duplicateOf: importIds.has(importId) ? importId : fingerprint,
          issues: ["A matching imported transaction already exists."],
        });
        continue;
      }

      const rawMerchant = merchantLabel(transaction);
      const merchantKey = [
        transaction.sourceId,
        normalizeMerchant(rawMerchant),
      ].join("\u0000");
      const merchantResolution =
        merchantResolutions.get(merchantKey) ??
        (() => {
          const pending = resolveMerchant(request, transaction);
          merchantResolutions.set(merchantKey, pending);
          return pending;
        })();
      const { resolution, issues: merchantIssues } = await merchantResolution;
      const suggestions: CategorySuggestion[] = [];
      const categorizationContext = {
        transaction,
        merchant:
          resolution.status === "confirmed" ? resolution.merchant : undefined,
        history: request.history ?? [],
        availableAccounts: request.availableAccounts ?? [],
      };
      for (const categorizer of request.categorizers ?? []) {
        if (categorizer.isAi && !shouldAskAi(suggestions)) continue;
        try {
          suggestions.push(
            ...(await categorizer.suggest({
              ...categorizationContext,
              priorSuggestions: sortSuggestions(suggestions),
            })),
          );
        } catch (error) {
          suggestions.push({
            account: "",
            rawScore: 0,
            scoreKind: "ai-advisory",
            method: "ai",
            explanation:
              "An optional categorizer was unavailable; review this transaction manually.",
            evidence: [],
          });
        }
      }
      const validSuggestions = sortSuggestions(
        suggestions.filter(
          (suggestion) =>
            Boolean(suggestion.account) &&
            (!request.availableAccounts?.length ||
              request.availableAccounts.includes(suggestion.account)),
        ),
      );
      let proposal: ImportProposal = {
        id: proposalId,
        importId,
        transaction,
        merchantResolution: resolution,
        suggestions: validSuggestions,
        selectedAccount: validSuggestions[0]?.account,
        status:
          transaction.status === "pending"
            ? "held"
            : validSuggestions.length
              ? "ready"
              : "needs-review",
        issues: merchantIssues,
      };
      for (const hook of request.hooks ?? []) {
        proposal = await hook.process(proposal, {
          history: request.history ?? [],
          availableAccounts: request.availableAccounts ?? [],
        });
      }
      importIds.add(importId);
      fingerprints.add(fingerprint);
      knownProposalIds.add(proposalId);
      proposals.push(proposal);
    }
  }

  const completedAt = new Date().toISOString();
  return {
    id: `run:${md5(`${request.sourceId}:${startedAt}`)}`,
    sourceId: request.sourceId,
    startedAt,
    completedAt,
    cursor,
    proposals,
    summary: statusSummary(proposals),
  };
}

/** @deprecated Import this adapter from `@beancount-js/beangulp/beancount` instead. */
export { proposalTransaction } from "./beancount";
