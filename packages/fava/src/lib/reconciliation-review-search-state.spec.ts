import { describe, expect, it } from "vitest";
import type { ReconciliationReviewItem } from "@beancount-js/server";
import {
  appendReconciliationReviewSearchParams,
  collectReconciliationReviewFacetOptions,
  filterReconciliationReviewSearch,
  hasActiveReconciliationReviewSearch,
  normaliseReconciliationLabel,
  paginateReconciliationReviewItems,
  parseReconciliationReviewSearchState,
  reconciliationKindLabel,
  type ReconciliationReviewSearchState,
} from "./reconciliation-review-search-state";

function candidate(
  partial: Partial<ReconciliationReviewItem> = {},
): ReconciliationReviewItem {
  return {
    candidate: {
      id: "candidate-1",
      kind: "overlap",
      memberIds: ["proposal:1", "ledger:1"],
      confidence: "high",
      evidence: [
        {
          kind: "same-account",
          summary: "Both records affect the same account.",
        },
      ],
      recommendedCanonicalId: "ledger:1",
      ...partial.candidate,
    },
    members: partial.members ?? [
      {
        observation: {
          id: "proposal:1",
          origin: "proposal",
          sourceId: "monzo",
          sourceAccount: "Assets:Checking:Monzo",
          bookedAt: "2026-07-01",
          amount: "-45.75",
          currency: "GBP",
          merchant: "Tesco",
        },
      },
      {
        observation: {
          id: "ledger:1",
          origin: "ledger",
          sourceAccount: "Assets:Checking:Monzo",
          bookedAt: "2026-07-01",
          amount: "-45.75",
          currency: "GBP",
          payee: "Tesco Stores",
        },
      },
    ],
    decision: partial.decision,
  };
}

describe("reconciliation-review-search-state", () => {
  it("round-trips all URL-backed facets", () => {
    const state: ReconciliationReviewSearchState = {
      query: "tesco",
      accounts: ["Assets:Checking:Monzo"],
      sources: ["monzo"],
      years: ["2026"],
      currencies: ["GBP"],
      kinds: ["overlap"],
      confidence: ["high"],
    };
    const params = new URLSearchParams();

    appendReconciliationReviewSearchParams(params, state);

    expect(parseReconciliationReviewSearchState(params)).toEqual(state);
    expect(hasActiveReconciliationReviewSearch(state)).toBe(true);
  });

  it("applies exact facets before fuzzy matching the records and evidence", () => {
    const tesco = candidate();
    const natwest = candidate({
      candidate: {
        id: "candidate-2",
        kind: "existing",
        memberIds: ["proposal:2", "ledger:2"],
        confidence: "possible",
        evidence: [
          {
            kind: "matching-label",
            summary: "The labels agree.",
          },
        ],
      },
      members: [
        {
          observation: {
            id: "proposal:2",
            origin: "proposal",
            sourceId: "starling",
            sourceAccount: "Assets:Checking:Starling",
            bookedAt: "2025-05-11",
            amount: "-34.39",
            currency: "GBP",
            merchant: "Natwest Platinum Card",
          },
        },
      ],
    });

    expect(
      filterReconciliationReviewSearch([tesco, natwest], {
        query: "teso",
        accounts: ["Assets:Checking:Monzo"],
        sources: ["monzo"],
        years: ["2026"],
        currencies: ["GBP"],
        kinds: ["overlap"],
        confidence: ["high"],
      }),
    ).toEqual([tesco]);
  });

  it("collects facets from every linked record and uses readable reason labels", () => {
    const item = candidate();

    expect(collectReconciliationReviewFacetOptions([item])).toMatchObject({
      accounts: ["Assets:Checking:Monzo"],
      sources: ["Existing ledger", "monzo"],
      years: ["2026"],
      currencies: ["GBP"],
      kinds: ["overlap"],
      confidence: ["high"],
    });
    expect(reconciliationKindLabel("overlap")).toBe("Same Account Overlap");
    expect(normaliseReconciliationLabel("Same-account overlap")).toBe(
      "Same Account Overlap",
    );
  });

  it("paginates individual matches without splitting their linked records", () => {
    const first = candidate();
    const second = candidate({
      candidate: {
        id: "candidate-2",
        kind: "existing",
        memberIds: ["proposal:2", "ledger:2"],
        confidence: "possible",
        evidence: [],
      },
    });
    const third = candidate({
      candidate: {
        id: "candidate-3",
        kind: "transfer",
        memberIds: ["proposal:3", "ledger:3"],
        confidence: "high",
        evidence: [],
      },
    });

    expect(
      paginateReconciliationReviewItems([first, second, third], 2),
    ).toEqual([[first, second], [third]]);
  });
});
