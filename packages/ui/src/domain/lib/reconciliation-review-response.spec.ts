import { describe, expect, it } from "vitest";
import type { ReconciliationReview } from "@beancount-js/server";
import { compactReconciliationReview } from "./reconciliation-review-response";

describe("compactReconciliationReview", () => {
  it("keeps display context while removing raw records and top-level observations", () => {
    const observation = {
      id: "proposal:run:one",
      origin: "proposal" as const,
      sourceId: "monzo",
      sourceAccount: "Assets:Checking:Monzo",
      bookedAt: "2026-07-01",
      amount: "-12.50",
      currency: "GBP",
      merchant: "Coffee shop",
      transaction: {
        sourceId: "monzo",
        sourceAccount: "Assets:Checking:Monzo",
        externalId: "one",
        bookedAt: "2026-07-01",
        amount: "-12.50",
        currency: "GBP",
        merchant: "Coffee shop",
        narration: "Coffee",
        status: "posted" as const,
        fetchedAt: "2026-07-01T12:00:00.000Z",
        metadata: { raw: "x".repeat(20_000) },
      },
    };
    const member = {
      observation,
      proposal: { runId: "run", proposalId: "one" },
    };
    const review: ReconciliationReview = {
      observations: [member],
      candidates: [
        {
          candidate: {
            id: "candidate",
            kind: "overlap",
            memberIds: [observation.id],
            confidence: "high",
            evidence: [
              {
                kind: "same-account",
                summary: "Both records affect the same account.",
              },
            ],
          },
          members: [member],
        },
      ],
    };

    const compact = compactReconciliationReview(review);

    expect(compact).toEqual({
      candidates: [
        {
          candidate: review.candidates[0]?.candidate,
          decision: undefined,
          members: [
            {
              observation: {
                id: observation.id,
                origin: "proposal",
                sourceId: "monzo",
                sourceAccount: "Assets:Checking:Monzo",
                bookedAt: "2026-07-01",
                amount: "-12.50",
                currency: "GBP",
                merchant: "Coffee shop",
                payee: undefined,
                narration: undefined,
                status: undefined,
              },
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(compact)).not.toContain("transaction");
    expect(JSON.stringify(compact).length).toBeLessThan(
      JSON.stringify(review).length / 10,
    );
  });
});
