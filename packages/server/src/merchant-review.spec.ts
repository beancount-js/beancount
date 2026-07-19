import { describe, expect, test } from "vitest";
import type { ImportProposal, IngestionRun } from "@beancount-js/beangulp";
import {
  applyMerchantResolutionToPendingProposals,
  clusterMerchantReviewProposals,
  isReviewedMerchantProposal,
  needsMerchantReview,
} from "./merchant-review";

function proposal(
  partial: Partial<ImportProposal> & Pick<ImportProposal, "id">,
): ImportProposal {
  return {
    importId: partial.importId ?? `import:${partial.id}`,
    suggestions: partial.suggestions ?? [],
    issues: partial.issues ?? [],
    status: partial.status ?? "needs-review",
    transaction: partial.transaction ?? {
      sourceId: "lunchflow:7072",
      sourceAccount: "Assets:Checking:Starling",
      bookedAt: "2026-07-01",
      amount: "-10.00",
      currency: "GBP",
      narration: "Tesco",
      merchant: "TESCO STORES",
      status: "posted",
      fetchedAt: "2026-07-01T00:00:00.000Z",
      metadata: {},
    },
    merchantResolution: partial.merchantResolution,
    selectedAccount: partial.selectedAccount,
    ...partial,
  };
}

describe("merchant review clusters", () => {
  test("groups every unconfirmed merchant by domain then primary token", () => {
    const rows = [
      {
        runId: "run:1",
        proposal: proposal({
          id: "p1",
          merchantResolution: {
            status: "suggested",
            rawLabel: "TESCO STORES",
            candidates: [
              {
                id: "ai:tesco:tesco.com",
                canonicalName: "Tesco",
                domain: "tesco.com",
                explanation: "Likely Tesco",
                provenance: [],
              },
            ],
            explanation: "Suggested",
          },
        }),
      },
      {
        runId: "run:1",
        proposal: proposal({
          id: "p2",
          transaction: {
            sourceId: "lunchflow:7072",
            sourceAccount: "Assets:Checking:Starling",
            bookedAt: "2026-07-02",
            amount: "-5.00",
            currency: "GBP",
            narration: "Tesco",
            merchant: "tesco",
            status: "posted",
            fetchedAt: "2026-07-02T00:00:00.000Z",
            metadata: {},
          },
          merchantResolution: {
            status: "unresolved",
            rawLabel: "tesco",
            explanation: "No match",
          },
        }),
      },
      {
        runId: "run:1",
        proposal: proposal({
          id: "p3",
          status: "ready",
          selectedAccount: "Expenses:Groceries",
          merchantResolution: {
            status: "suggested",
            rawLabel: "TESCO STORES",
            candidates: [
              {
                id: "ai:tesco:tesco.com",
                canonicalName: "Tesco",
                domain: "tesco.com",
                explanation: "Likely Tesco",
                provenance: [],
              },
            ],
            explanation: "Suggested",
          },
        }),
      },
    ];

    expect(needsMerchantReview(rows[2]!.proposal)).toBe(true);
    const clusters = clusterMerchantReviewProposals(rows);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.domain).toBe("tesco.com");
    expect(clusters[0]!.pendingCount).toBe(3);
    expect(clusters[0]!.members.map((m) => m.normalizedLabel).sort()).toEqual([
      "tesco",
      "tesco stores",
    ]);
    expect(clusters[0]!.transactions).toHaveLength(3);
  });

  test("keeps unconfirmed merchants pending after transaction review", () => {
    const rows = [
      {
        runId: "run:1",
        proposal: proposal({
          id: "confirmed",
          merchantResolution: {
            status: "confirmed",
            rawLabel: "TESCO STORES",
            merchant: {
              merchantId: "m1",
              canonicalName: "Tesco",
              aliases: [],
              domain: "tesco.com",
              provenance: [],
            },
            explanation: "Confirmed",
          },
        }),
      },
      {
        runId: "run:1",
        proposal: proposal({
          id: "accepted",
          status: "accepted",
          merchantResolution: {
            status: "suggested",
            rawLabel: "TESCO EXPRESS",
            candidates: [],
            explanation: "Suggested",
          },
        }),
      },
      {
        runId: "run:1",
        proposal: proposal({
          id: "pending",
          merchantResolution: {
            status: "unresolved",
            rawLabel: "Tesco Metro",
            explanation: "No match",
          },
        }),
      },
    ];

    expect(isReviewedMerchantProposal(rows[0]!.proposal)).toBe(true);
    expect(isReviewedMerchantProposal(rows[1]!.proposal)).toBe(false);
    expect(isReviewedMerchantProposal(rows[2]!.proposal)).toBe(false);
    const pending = clusterMerchantReviewProposals(rows);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.pendingCount).toBe(2);

    const reviewed = clusterMerchantReviewProposals(rows, "reviewed");
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0]!.pendingCount).toBe(1);
    expect(reviewed[0]!.statuses).toEqual(["confirmed"]);
  });
});

describe("applyMerchantResolutionToPendingProposals", () => {
  test("updates matching merchants without changing transaction acceptance", () => {
    const confirmed = {
      status: "confirmed" as const,
      rawLabel: "TESCO STORES",
      merchant: {
        merchantId: "m1",
        canonicalName: "Tesco",
        aliases: [],
        domain: "tesco.com",
        provenance: [],
      },
      explanation: "Confirmed",
    };
    const runs: IngestionRun[] = [
      {
        id: "run:1",
        sourceId: "lunchflow:7072",
        startedAt: "2026-07-01T00:00:00.000Z",
        completedAt: "2026-07-01T00:00:01.000Z",
        cursor: undefined,
        summary: {
          total: 3,
          ready: 1,
          needsReview: 2,
          accepted: 0,
          duplicates: 0,
          invalid: 0,
          held: 0,
          excluded: 0,
        },
        proposals: [
          proposal({
            id: "pending-a",
            merchantResolution: {
              status: "suggested",
              rawLabel: "TESCO STORES",
              candidates: [],
              explanation: "Suggested",
            },
          }),
          proposal({
            id: "pending-b",
            merchantResolution: {
              status: "unresolved",
              rawLabel: "tesco stores",
              explanation: "No match",
            },
          }),
          proposal({
            id: "accepted",
            status: "accepted",
            merchantResolution: {
              status: "suggested",
              rawLabel: "TESCO STORES",
              candidates: [],
              explanation: "Suggested",
            },
          }),
        ],
      },
    ];

    const result = applyMerchantResolutionToPendingProposals(
      runs,
      "lunchflow",
      new Set(["tesco stores"]),
      confirmed,
    );

    expect(result.updatedCount).toBe(3);
    const next = result.runs[0]!.proposals;
    expect(next.find((p) => p.id === "pending-a")?.merchantResolution).toEqual(
      confirmed,
    );
    expect(
      next.find((p) => p.id === "pending-b")?.merchantResolution?.status,
    ).toBe("confirmed");
    const accepted = next.find((p) => p.id === "accepted")!;
    expect(accepted.status).toBe("accepted");
    expect(accepted.merchantResolution?.status).toBe("confirmed");
  });
});
