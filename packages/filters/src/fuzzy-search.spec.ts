import { describe, expect, test } from "vitest";
import { fuzzySearch } from "./fuzzy-search";

const accounts = [
  { label: "Savings", keywords: ["piggy bank", "emergency fund"] },
  { label: "Dining", keywords: ["restaurant", "cafe", "food"] },
  { label: "Travel", keywords: ["flight", "holiday", "plane"] },
];

describe("fuzzySearch", () => {
  test("preserves browse order for an empty query", () => {
    expect(fuzzySearch(accounts, "", { keys: ["label", "keywords"] })).toEqual(
      accounts,
    );
  });

  test("matches labels and metadata despite minor typos", () => {
    expect(
      fuzzySearch(accounts, "pggy bk", {
        keys: [{ name: "label", weight: 2 }, "keywords"],
      }).map((account) => account.label),
    ).toEqual(["Savings"]);
  });
});
