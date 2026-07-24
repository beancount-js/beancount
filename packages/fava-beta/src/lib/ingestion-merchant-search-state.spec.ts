import { describe, expect, it } from "vitest";
import type { MerchantReviewCluster } from "@beancount-js/server";
import {
  appendIngestionMerchantSearchParams,
  filterIngestionMerchantSearch,
  hasActiveIngestionMerchantSearch,
  matchesIngestionMerchantSearch,
  parseIngestionMerchantSearchState,
  type IngestionMerchantSearchState,
} from "./ingestion-merchant-search-state";

function cluster(
  partial: Partial<MerchantReviewCluster>,
): MerchantReviewCluster {
  return {
    id: partial.id ?? "cluster-1",
    displayName: partial.displayName ?? "Tesco",
    domain: partial.domain,
    logoUrl: partial.logoUrl,
    statuses: partial.statuses ?? ["suggested"],
    pendingCount: partial.pendingCount ?? 2,
    members: partial.members ?? [
      {
        rawLabel: "TESCO STORES 1234",
        normalizedLabel: "tesco stores 1234",
        count: 1,
        refs: [{ runId: "run-1", proposalId: "p1" }],
      },
    ],
    candidates: partial.candidates ?? [],
    transactions: partial.transactions ?? [],
    explanation: partial.explanation,
    primary: partial.primary ?? {
      runId: "run-1",
      proposalId: "p1",
    },
  };
}

describe("ingestion-merchant-search-state", () => {
  it("round-trips URL params", () => {
    const state: IngestionMerchantSearchState = {
      query: "tesco",
      statuses: ["suggested"],
      domain: "has",
    };
    const params = new URLSearchParams();
    appendIngestionMerchantSearchParams(params, state);
    expect(parseIngestionMerchantSearchState(params)).toEqual(state);
    expect(hasActiveIngestionMerchantSearch(state)).toBe(true);
  });

  it("matches free text, status, and domain facets", () => {
    const withDomain = cluster({
      displayName: "Tesco",
      domain: "tesco.com",
      statuses: ["suggested"],
    });
    const missingDomain = cluster({
      id: "cluster-2",
      displayName: "Unknown Cafe",
      statuses: ["unresolved"],
      members: [
        {
          rawLabel: "CAFE 99",
          normalizedLabel: "cafe 99",
          count: 1,
          refs: [{ runId: "run-1", proposalId: "p2" }],
        },
      ],
    });

    expect(
      matchesIngestionMerchantSearch(withDomain, {
        query: "stores",
        statuses: [],
        domain: "",
      }),
    ).toBe(true);
    expect(
      matchesIngestionMerchantSearch(withDomain, {
        query: "",
        statuses: ["suggested"],
        domain: "has",
      }),
    ).toBe(true);
    expect(
      matchesIngestionMerchantSearch(missingDomain, {
        query: "",
        statuses: [],
        domain: "missing",
      }),
    ).toBe(true);
    expect(
      matchesIngestionMerchantSearch(withDomain, {
        query: "",
        statuses: [],
        domain: "missing",
      }),
    ).toBe(false);
  });

  it("fuzzy-matches merchant text after applying exact facets", () => {
    const tesco = cluster({
      displayName: "Tesco",
      domain: "tesco.com",
      statuses: ["suggested"],
    });
    const cafe = cluster({
      id: "cluster-2",
      displayName: "Unknown Cafe",
      statuses: ["suggested"],
    });

    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        query: "teso",
        statuses: ["suggested"],
        domain: "has",
      }),
    ).toEqual([tesco]);
  });

  it("supports shared filter-query syntax for merchant fields", () => {
    const tesco = cluster({
      displayName: "Tesco",
      domain: "tesco.com",
      statuses: ["suggested"],
      pendingCount: 30,
      candidates: [
        {
          id: "merchant-tesco",
          canonicalName: "Tesco",
          domain: "tesco.com",
          rawScore: 0.98,
          explanation: "Exact domain match",
          provenance: [],
        },
      ],
      transactions: [
        {
          runId: "run-1",
          proposalId: "p1",
          bookedAt: "2026-07-17",
          amount: "-29.97",
          currency: "GBP",
          payee: "Tesco",
          narration: "Weekly groceries",
          rawLabel: "TESCO STORES 1234",
          sourceAccount: "Assets:Checking:Monzo",
          proposalStatus: "needs-review",
        },
      ],
    });
    const cafe = cluster({
      id: "cluster-2",
      displayName: "Unknown Cafe",
      statuses: ["unresolved"],
      pendingCount: 4,
      members: [
        {
          rawLabel: "CAFE 99",
          normalizedLabel: "cafe 99",
          count: 1,
          refs: [{ runId: "run-1", proposalId: "p2" }],
        },
      ],
    });
    const empty = { query: "", statuses: [], domain: "" };

    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        ...empty,
        query: "confidence >= 0.9",
      }),
    ).toEqual([tesco]);
    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        ...empty,
        query: "pending > 10 status:suggested",
      }),
    ).toEqual([tesco]);
    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        ...empty,
        query: "domain:tesco.com OR status:unresolved",
      }),
    ).toEqual([tesco, cafe]);
    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        ...empty,
        query: "label:cafe",
      }),
    ).toEqual([cafe]);
    expect(
      filterIngestionMerchantSearch([tesco, cafe], {
        ...empty,
        query: "amount > 20 account:Monzo currency:GBP",
      }),
    ).toEqual([tesco]);
  });
});
