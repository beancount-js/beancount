import { describe, expect, test } from "vitest";
import type { ImportProposal } from "@beancount-js/beangulp";
import {
  ingestionProposalReviewBucket,
  ingestionProposalReviewLabel,
} from "./review-classification";

function proposal(
  status: ImportProposal["status"],
  rawScore: number,
  hard = false,
): ImportProposal {
  return {
    id: "proposal:1",
    importId: "import:1",
    transaction: {
      sourceId: "bank",
      sourceAccount: "checking",
      externalId: "transaction:1",
      bookedAt: "2026-07-17",
      amount: "-12.34",
      currency: "GBP",
      narration: "Groceries",
      status: "posted",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      metadata: {},
    },
    suggestions: [
      {
        account: "Expenses:Food:Groceries",
        method: hard ? "rule" : "ai",
        rawScore,
        scoreKind: hard ? "rule-certainty" : "ai-advisory",
        support: 0,
        hard,
        explanation: "Categorisation evidence",
        evidence: [],
      },
    ],
    selectedAccount: "Expenses:Food:Groceries",
    status,
    issues: [],
  };
}

describe("ingestion proposal review classification", () => {
  test("keeps legacy below-threshold ready records in review", () => {
    const item = proposal("ready", 0.8);
    expect(ingestionProposalReviewBucket(item)).toBe("review");
    expect(ingestionProposalReviewLabel(item)).toBe("review");
  });

  test("labels proposals that meet the acceptance threshold as ready", () => {
    const item = proposal("ready", 0.9);
    expect(ingestionProposalReviewBucket(item)).toBe("ready");
    expect(ingestionProposalReviewLabel(item)).toBe("ready");
  });

  test("keeps held proposals in review without hiding their state", () => {
    const item = proposal("held", 0.9);
    expect(ingestionProposalReviewBucket(item)).toBe("review");
    expect(ingestionProposalReviewLabel(item)).toBe("held");
  });
});
