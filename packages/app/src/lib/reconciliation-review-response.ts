import type {
  ReconciliationCandidate,
  ReconciliationObservation,
} from "@beancount-js/beangulp";
import type {
  ConfirmedProposalReconciliation,
  ReconciliationDecision,
  ReconciliationReview,
} from "@beancount-js/server";

export type ReconciliationReviewDisplayObservation = Pick<
  ReconciliationObservation,
  | "id"
  | "origin"
  | "sourceId"
  | "sourceAccount"
  | "bookedAt"
  | "amount"
  | "currency"
  | "merchant"
  | "payee"
  | "narration"
  | "status"
>;

export type ReconciliationReviewDisplayItem = {
  candidate: ReconciliationCandidate;
  members: { observation: ReconciliationReviewDisplayObservation }[];
  decision?: ReconciliationDecision;
};

export type ReconciliationReviewResponse = {
  candidates: ReconciliationReviewDisplayItem[];
};

export type ConfirmedProposalReconciliationResponse = Pick<
  ConfirmedProposalReconciliation,
  "runId" | "proposalId" | "candidateId" | "kind" | "canonicalObservationId"
>;

export type ReconciliationProposalReconciliationsResponse = {
  reconciliations: ConfirmedProposalReconciliationResponse[];
};

function compactObservation(
  observation: ReconciliationObservation,
): ReconciliationReviewDisplayObservation {
  return {
    id: observation.id,
    origin: observation.origin,
    sourceId: observation.sourceId,
    sourceAccount: observation.sourceAccount,
    bookedAt: observation.bookedAt,
    amount: observation.amount,
    currency: observation.currency,
    merchant: observation.merchant,
    payee: observation.payee,
    narration: observation.narration,
    status: observation.status,
  };
}

/** Strip write-only refs and raw transaction payloads from the review response. */
export function compactReconciliationReview(
  review: ReconciliationReview,
): ReconciliationReviewResponse {
  return {
    candidates: review.candidates.map((item) => ({
      candidate: item.candidate,
      decision: item.decision,
      members: item.members.map((member) => ({
        observation: compactObservation(member.observation),
      })),
    })),
  };
}

export function compactConfirmedProposalReconciliations(
  reconciliations: readonly ConfirmedProposalReconciliation[],
): ReconciliationProposalReconciliationsResponse {
  return {
    reconciliations: reconciliations.map((item) => ({
      runId: item.runId,
      proposalId: item.proposalId,
      candidateId: item.candidateId,
      kind: item.kind,
      canonicalObservationId: item.canonicalObservationId,
    })),
  };
}
