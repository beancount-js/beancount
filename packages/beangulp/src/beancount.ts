import { Amount, Posting, Transaction } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import type { ImportProposal } from "./types";

/**
 * Render a reviewed single-account proposal as a conventional two-posting
 * Beancount transaction. This adapter is deliberately outside the ingestion
 * pipeline: callers remain responsible for validation and persistence.
 */
export function proposalTransaction(proposal: ImportProposal, account: string) {
  if (!proposal.transaction)
    throw new Error(
      "Cannot render a proposal without a normalized transaction.",
    );
  const transaction = proposal.transaction;
  const date = DateTime.fromISO(transaction.bookedAt, { zone: "utc" });
  if (!date.isValid)
    throw new Error("Cannot render a proposal with an invalid booking date.");
  const suggestion = proposal.suggestions.find(
    (item) => item.account === account,
  );
  const merchant =
    proposal.merchantResolution?.status === "confirmed"
      ? proposal.merchantResolution.merchant
      : undefined;
  const metadata: Record<string, string | number> = {
    import_id: proposal.importId,
    import_source: transaction.sourceId,
    import_fetched_at: transaction.fetchedAt,
    category_method: suggestion?.method ?? "manual",
  };
  if (suggestion?.rawScore !== undefined)
    metadata.category_score = suggestion.rawScore;
  if (suggestion?.scoreKind)
    metadata.category_score_kind = suggestion.scoreKind;
  if (suggestion?.support !== undefined)
    metadata.category_support = suggestion.support;
  if (suggestion?.calibratedProbability !== undefined)
    metadata.category_confidence = suggestion.calibratedProbability;
  if (transaction.merchant) metadata.merchant_raw = transaction.merchant;
  if (merchant) {
    metadata.merchant_id = merchant.merchantId;
    metadata.merchant_resolution_method =
      merchant.provenance.at(-1)?.source ?? "alias";
    if (merchant.domain) metadata.merchant_domain = merchant.domain;
  }

  for (const [key, value] of Object.entries(transaction.metadata ?? {})) {
    if (value === undefined || value === null) continue;
    if (key in metadata) continue;
    metadata[key] = value;
  }

  return new Transaction(
    date,
    "*",
    merchant?.canonicalName ?? transaction.payee ?? transaction.merchant ?? "",
    transaction.narration,
    [...(transaction.tags ?? [])],
    [...(transaction.links ?? [])],
    [
      new Posting(
        transaction.sourceAccount,
        new Amount(transaction.amount, transaction.currency),
      ),
      new Posting(account),
    ],
    metadata,
  );
}
