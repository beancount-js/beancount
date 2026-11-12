import { describe, expect, it } from "vitest";
import type { ImportProposal } from "../ingestion/types";
import {
  appendIngestionReviewSearchParams,
  filterIngestionReviewSearch,
  hasActiveIngestionReviewSearch,
  matchesIngestionReviewSearch,
  parseIngestionReviewSearchState,
  type IngestionReviewSearchState,
} from "./ingestion-review-search-state";

function proposal(
  partial: Partial<ImportProposal> & {
    transaction?: ImportProposal["transaction"];
  },
): ImportProposal {
  return {
    id: partial.id ?? "p1",
    importId: partial.importId ?? "import-1",
    suggestions: partial.suggestions ?? [],
    status: partial.status ?? "needs-review",
    issues: partial.issues ?? [],
    selectedAccount: partial.selectedAccount,
    merchantResolution: partial.merchantResolution,
    transaction: partial.transaction,
  };
}

describe("ingestion-review-search-state", () => {
  it("round-trips URL params", () => {
    const state: IngestionReviewSearchState = {
      query: "tesco",
      accounts: ["Expenses:Groceries"],
      merchantStatuses: ["suggested", "confirmed"],
      years: ["2026"],
      currencies: ["GBP"],
    };
    const params = new URLSearchParams();
    appendIngestionReviewSearchParams(params, state);
    expect(parseIngestionReviewSearchState(params)).toEqual(state);
    expect(hasActiveIngestionReviewSearch(state)).toBe(true);
  });

  it("matches free text and facets", () => {
    const row = proposal({
      selectedAccount: "Expenses:Groceries",
      merchantResolution: {
        status: "suggested",
        rawLabel: "TESCO STORES",
        explanation: "",
        candidates: [
          {
            id: "c1",
            canonicalName: "Tesco",
            domain: "tesco.com",
            explanation: "",
            provenance: [],
          },
        ],
      },
      transaction: {
        sourceId: "bank",
        sourceAccount: "Assets:Bank",
        bookedAt: "2026-07-01",
        amount: "-12.34",
        currency: "GBP",
        merchant: "TESCO",
        payee: "Tesco",
        narration: "Groceries",
        status: "posted",
        fetchedAt: "2026-07-01T12:00:00.000Z",
        metadata: {},
      },
    });

    expect(
      matchesIngestionReviewSearch(row, {
        query: "tesco",
        accounts: [],
        merchantStatuses: [],
        years: [],
        currencies: [],
      }),
    ).toBe(true);
    expect(
      matchesIngestionReviewSearch(row, {
        query: "",
        accounts: ["Expenses:Groceries"],
        merchantStatuses: ["suggested"],
        years: ["2026"],
        currencies: ["GBP"],
      }),
    ).toBe(true);
    expect(
      matchesIngestionReviewSearch(row, {
        query: "",
        accounts: [],
        merchantStatuses: ["confirmed"],
        years: [],
        currencies: [],
      }),
    ).toBe(false);
  });

  it("fuzzy-matches free text after applying exact facets", () => {
    const groceries = proposal({
      id: "groceries",
      selectedAccount: "Expenses:Groceries",
      transaction: {
        sourceId: "bank",
        sourceAccount: "Assets:Bank",
        bookedAt: "2026-07-01",
        amount: "-12.34",
        currency: "GBP",
        merchant: "TESCO",
        payee: "Tesco",
        narration: "Groceries",
        status: "posted",
        fetchedAt: "2026-07-01T12:00:00.000Z",
        metadata: {},
      },
    });
    const travel = proposal({
      id: "travel",
      selectedAccount: "Expenses:Travel",
    });

    expect(
      filterIngestionReviewSearch([groceries, travel], {
        query: "teso",
        accounts: ["Expenses:Groceries"],
        merchantStatuses: [],
        years: [],
        currencies: [],
      }),
    ).toEqual([groceries]);
  });
});
