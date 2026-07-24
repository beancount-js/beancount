import {
  proposalIsReadyForAcceptance,
  type ImportProposal,
} from "@beancount-js/beangulp";

type ReviewableProposal = Pick<
  ImportProposal,
  "selectedAccount" | "status" | "suggestions" | "transaction"
>;

export type IngestionProposalReviewBucket = "ready" | "review" | "other";

/** Classify a proposal using the same acceptance threshold as the write API. */
export function ingestionProposalReviewBucket(
  proposal: ReviewableProposal,
): IngestionProposalReviewBucket {
  if (!proposal.transaction) return "other";
  if (proposalIsReadyForAcceptance(proposal)) return "ready";
  return proposal.status === "ready" ||
    proposal.status === "needs-review" ||
    proposal.status === "held"
    ? "review"
    : "other";
}

/**
 * Present legacy below-threshold `ready` records according to their real
 * bucket.
 */
export function ingestionProposalReviewLabel(proposal: ReviewableProposal) {
  const bucket = ingestionProposalReviewBucket(proposal);
  if (bucket === "ready") return "ready";
  if (bucket === "review" && proposal.status !== "held") return "review";
  return proposal.status.replaceAll("-", " ");
}
