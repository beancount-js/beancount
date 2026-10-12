import { describe, expect, it } from "vitest";
import {
  fuzzySearchMerchants,
  fuzzySearchPaths,
  rankLocalMerchantMatches,
} from "./fuzzy-search";

const merchants = [
  {
    canonicalName: "American Express",
    domain: "americanexpress.com",
    aliases: [{ normalizedValue: "amex" }],
  },
  {
    canonicalName: "Starling Bank",
    domain: "starlingbank.com",
    aliases: [],
  },
];

describe("Fava fuzzy search helpers", () => {
  it("fuzzy-ranks merchant names, domains, and aliases", () => {
    expect(fuzzySearchMerchants(merchants, "amricn exp")[0]).toBe(merchants[0]);
    expect(fuzzySearchMerchants(merchants, "amex")[0]).toBe(merchants[0]);
  });

  it("keeps an exact local domain match ahead of fuzzy fallback matches", () => {
    expect(
      rankLocalMerchantMatches(merchants, "starlng", "americanexpress.com"),
    ).toEqual([merchants[0], merchants[1]]);
  });

  it("fuzzy-ranks paths and retains the requested response limit", () => {
    const files = [
      { path: "ledger/receipts/2026.bean" },
      { path: "ledger/income.bean" },
      { path: "ledger/receipts/2025.bean" },
    ];

    expect(fuzzySearchPaths(files, "reciepts", 1)).toEqual([files[0]]);
    expect(fuzzySearchPaths(files, "", 2)).toEqual(files.slice(0, 2));
  });
});
