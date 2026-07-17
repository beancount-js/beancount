import { Amount, Posting, Transaction } from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/parser";
import { DateTime } from "luxon";
import type { ImportProposal } from "./types";

/**
 * Render a reviewed single-account proposal as a conventional two-posting
 * Beancount transaction. This adapter is deliberately outside the ingestion
 * pipeline: callers remain responsible for validation and persistence.
 */
type ProposalTransactionOptions = {
  /** Additional provider records represented by the same ledger directive. */
  alternates?: readonly ImportProposal[];
};

function sourceMetadata(proposal: ImportProposal) {
  const transaction = proposal.transaction;
  if (!transaction) throw new Error("Proposal has no normalized transaction.");
  return {
    import_id: proposal.importId,
    import_source: transaction.sourceId,
    import_fetched_at: transaction.fetchedAt,
  };
}

function alternateMetadata(
  metadata: Record<string, string | number>,
  alternates: readonly ImportProposal[],
) {
  for (const [index, proposal] of alternates.entries()) {
    const transaction = proposal.transaction;
    if (!transaction) continue;
    const prefix = `import_alt_${index + 1}`;
    metadata[`${prefix}_id`] = proposal.importId;
    metadata[`${prefix}_source`] = transaction.sourceId;
    metadata[`${prefix}_fetched_at`] = transaction.fetchedAt;
  }
}

export function proposalTransaction(
  proposal: ImportProposal,
  account: string,
  options: ProposalTransactionOptions = {},
) {
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
    ...sourceMetadata(proposal),
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
  alternateMetadata(metadata, options.alternates ?? []);

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
        null,
        null,
        "",
        sourceMetadata(proposal),
      ),
      new Posting(account),
    ],
    metadata,
  );
}

/** Render two confirmed account legs as one balanced transfer transaction. */
export function transferTransaction(
  first: ImportProposal,
  second: ImportProposal,
) {
  if (!first.transaction || !second.transaction) {
    throw new Error(
      "Cannot render a transfer without two normalized transactions.",
    );
  }
  const left = first.transaction;
  const right = second.transaction;
  const date = DateTime.fromISO(left.bookedAt, { zone: "utc" });
  if (!date.isValid)
    throw new Error("Cannot render a transfer with an invalid booking date.");
  const leftAmount = new Decimal(left.amount);
  const rightAmount = new Decimal(right.amount);
  const metadata: Record<string, string | number> = {
    ...sourceMetadata(first),
    transfer: "true",
  };
  alternateMetadata(metadata, [second]);

  let postings: Posting[];
  if (left.currency === right.currency && leftAmount.plus(rightAmount).eq(0)) {
    postings = [
      new Posting(
        left.sourceAccount,
        new Amount(left.amount, left.currency),
        null,
        null,
        "",
        sourceMetadata(first),
      ),
      new Posting(
        right.sourceAccount,
        new Amount(right.amount, right.currency),
        null,
        null,
        "",
        sourceMetadata(second),
      ),
    ];
  } else {
    const leftEvidence = left.transferEvidence?.sourceAmount;
    const rightEvidence = right.transferEvidence?.sourceAmount;
    const leftSupportsRight =
      leftEvidence?.currency === right.currency &&
      new Decimal(leftEvidence.amount).eq(rightAmount.abs());
    const rightSupportsLeft =
      rightEvidence?.currency === left.currency &&
      new Decimal(rightEvidence.amount).eq(leftAmount.abs());
    if (!leftSupportsRight && !rightSupportsLeft) {
      throw new Error(
        "Cross-currency transfers need provider evidence that names the matching source amount.",
      );
    }
    // Price the opposite-currency leg from the two recorded amounts, preserving
    // an exactly balanced directive while retaining provider rates in metadata.
    const priceCurrency = left.currency;
    const price = leftAmount.abs().div(rightAmount.abs()).toString();
    postings = [
      new Posting(
        left.sourceAccount,
        new Amount(left.amount, left.currency),
        null,
        null,
        "",
        sourceMetadata(first),
      ),
      new Posting(
        right.sourceAccount,
        new Amount(right.amount, right.currency),
        null,
        new Amount(price, priceCurrency),
        "",
        sourceMetadata(second),
      ),
    ];
    if (left.transferEvidence?.exchangeRate) {
      metadata.provider_exchange_rate = left.transferEvidence.exchangeRate;
    } else if (right.transferEvidence?.exchangeRate) {
      metadata.provider_exchange_rate = right.transferEvidence.exchangeRate;
    }
  }
  return new Transaction(
    date,
    "*",
    "",
    left.narration || right.narration || "Transfer",
    [],
    [],
    postings,
    metadata,
  );
}
