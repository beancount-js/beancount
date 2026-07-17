import { md5 } from "@beancount-js/parser";
import {
  normalizeMerchant,
  sortSuggestions,
  suggestionsMeetAutoReadyThreshold,
} from "./categorize";
import type {
  CategorySuggestion,
  ImportProposal,
  IngestionProgress,
  IngestionRequest,
  IngestionRun,
  JsonRecord,
  MerchantResolution,
  NormalizedTransaction,
} from "./types";

async function emitProgress(
  request: IngestionRequest<unknown, unknown>,
  progress: IngestionProgress,
) {
  await request.onProgress?.(progress);
}

export function transactionFingerprint(transaction: NormalizedTransaction) {
  return md5(
    [
      transaction.sourceId,
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

/**
 * Namespace an external record id by a connector kind. Unlike `importIdentity`
 * this deliberately excludes the configured connection/account so that the
 * exact same provider record repeated by another connection is safe to skip.
 */
export function providerImportIdentity(
  provider: string | undefined,
  transaction: NormalizedTransaction,
) {
  const key = provider?.trim().toLowerCase();
  const externalId = transaction.externalId?.trim();
  return key && externalId ? `${key}:${externalId}` : undefined;
}

/** Produce a current status summary for an archived or in-flight import run. */
export function summarizeIngestionProposals(
  proposals: readonly ImportProposal[],
) {
  return {
    total: proposals.length,
    ready: proposals.filter((proposal) => proposal.status === "ready").length,
    needsReview: proposals.filter(
      (proposal) => proposal.status === "needs-review",
    ).length,
    accepted: proposals.filter((proposal) => proposal.status === "accepted")
      .length,
    duplicates: proposals.filter((proposal) => proposal.status === "duplicate")
      .length,
    invalid: proposals.filter((proposal) => proposal.status === "invalid")
      .length,
    held: proposals.filter((proposal) => proposal.status === "held").length,
    excluded: proposals.filter((proposal) => proposal.status === "excluded")
      .length,
  };
}

function proposalForInvalid(
  id: string,
  importId: string,
  issue: string,
  sourceRecord?: JsonRecord,
): ImportProposal {
  return {
    id,
    importId,
    sourceRecord,
    suggestions: [],
    status: "invalid",
    issues: [issue],
  };
}

function shouldAskAi(suggestions: readonly CategorySuggestion[]) {
  return !suggestionsMeetAutoReadyThreshold(suggestions);
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
  const providerImportIds = new Set(request.existingProviderImportIds ?? []);
  const knownProposalIds = new Set<string>();
  const merchantResolutions = new Map<
    string,
    Promise<{ resolution: MerchantResolution; issues: string[] }>
  >();
  let cursor = request.cursor;
  let row = 0;
  let pagesFetched = 0;
  const importedBefore = proposals.length;

  await emitProgress(request as IngestionRequest<unknown, unknown>, {
    stage: "fetch",
    message: "Fetching transactions…",
    pagesFetched: 0,
    seen: 0,
    imported: 0,
  });

  for await (const page of request.source.read(request.sourceConfig, {
    sourceId: request.sourceId,
    cursor,
    ...request.sourceContext,
  })) {
    pagesFetched += 1;
    cursor = page.nextCursor;
    await emitProgress(request as IngestionRequest<unknown, unknown>, {
      stage: "fetch",
      message: `Fetched page ${pagesFetched}${page.records.length ? ` (${page.records.length} records)` : ""}`,
      pagesFetched,
      seen: proposals.length,
      imported: proposals.filter((proposal) => proposal.status !== "duplicate")
        .length,
    });
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
            record as JsonRecord,
          ),
        );
        continue;
      }

      const transaction = normalized.transaction;
      const importId = importIdentity(transaction);
      const fingerprint = transactionFingerprint(transaction);
      const proposalId = `proposal:${md5(importId)}`;
      const providerImportId = request.providerImportIdentity?.(transaction);
      if (
        importIds.has(importId) ||
        knownProposalIds.has(proposalId) ||
        fingerprints.has(fingerprint) ||
        (providerImportId !== undefined &&
          providerImportIds.has(providerImportId))
      ) {
        proposals.push({
          id: proposalId,
          importId,
          transaction,
          sourceRecord: record as JsonRecord,
          suggestions: [],
          status: "duplicate",
          duplicateOf: importIds.has(importId)
            ? importId
            : providerImportId && providerImportIds.has(providerImportId)
              ? providerImportId
              : fingerprint,
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
        sourceRecord: record as JsonRecord,
        merchantResolution: resolution,
        suggestions: validSuggestions,
        selectedAccount: validSuggestions[0]?.account,
        status:
          transaction.status === "pending"
            ? "held"
            : suggestionsMeetAutoReadyThreshold(validSuggestions)
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
      if (providerImportId) providerImportIds.add(providerImportId);
      knownProposalIds.add(proposalId);
      proposals.push(proposal);
    }
    await emitProgress(request as IngestionRequest<unknown, unknown>, {
      stage: "process",
      message: `Processed ${proposals.length - importedBefore} transaction${
        proposals.length - importedBefore === 1 ? "" : "s"
      }`,
      pagesFetched,
      seen: proposals.length,
      imported: proposals.filter((proposal) => proposal.status !== "duplicate")
        .length,
    });
  }

  const completedAt = new Date().toISOString();
  const summary = summarizeIngestionProposals(proposals);
  await emitProgress(request as IngestionRequest<unknown, unknown>, {
    stage: "complete",
    message: `Finished ${summary.total} proposal${summary.total === 1 ? "" : "s"}`,
    pagesFetched,
    seen: summary.total,
    imported: summary.total - summary.duplicates,
  });
  return {
    id: `run:${md5(`${request.sourceId}:${startedAt}`)}`,
    sourceId: request.sourceId,
    startedAt,
    completedAt,
    cursor,
    proposals,
    summary,
  };
}

/** @deprecated Import this adapter from `@beancount-js/beangulp/beancount` instead. */
export { proposalTransaction } from "./beancount";
