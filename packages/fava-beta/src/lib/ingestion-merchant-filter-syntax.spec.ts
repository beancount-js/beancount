import { describe, expect, it } from "vitest";
import type { MerchantReviewCluster } from "@beancount-js/server";
import { merchantReviewFilterSyntax } from "./ingestion-merchant-filter-syntax";

function cluster(
  partial: Partial<MerchantReviewCluster>,
): MerchantReviewCluster {
  return {
    id: partial.id ?? "cluster-1",
    displayName: partial.displayName ?? "Coffee Shop",
    domain: partial.domain,
    logoUrl: partial.logoUrl,
    statuses: partial.statuses ?? ["suggested"],
    pendingCount: partial.pendingCount ?? 1,
    members: partial.members ?? [],
    candidates: partial.candidates ?? [],
    transactions: partial.transactions ?? [],
    explanation: partial.explanation,
    primary: partial.primary ?? { runId: "run-1", proposalId: "p1" },
  };
}

describe("merchant review filter syntax", () => {
  it("documents executable fields and supplies quoted dynamic values", () => {
    const syntax = merchantReviewFilterSyntax([
      cluster({
        domain: "coffee.example",
        candidates: [
          {
            id: "merchant-coffee",
            canonicalName: "Coffee Shop",
            domain: "coffee.example",
            rawScore: 0.98,
            explanation: "Exact domain",
            provenance: [],
          },
        ],
        transactions: [
          {
            runId: "run-1",
            proposalId: "p1",
            bookedAt: "2026-07-21",
            amount: "-4.50",
            currency: "GBP",
            narration: "Coffee",
            rawLabel: "COFFEE SHOP",
            sourceAccount: "Assets:Checking:Monzo",
            proposalStatus: "needs-review",
          },
        ],
      }),
    ]);
    const merchant = syntax.fields.find((field) => field.name === "merchant");
    const status = syntax.fields.find((field) => field.name === "status");
    const confidence = syntax.fields.find(
      (field) => field.name === "confidence",
    );

    expect(merchant?.values).toEqual([
      { value: "Coffee Shop", apply: '"Coffee Shop"' },
    ]);
    expect(status?.values).toEqual(
      expect.arrayContaining([{ value: "suggested", apply: "suggested" }]),
    );
    expect(confidence?.aliases).toEqual(["ai.confidence", "score"]);
    expect(syntax.examples?.[0]?.query).toBe("confidence >= 0.9");
  });
});
