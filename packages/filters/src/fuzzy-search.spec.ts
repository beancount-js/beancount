import { describe, expect, test } from "vitest";
import { fuzzySearch, fuzzySearchWithScores } from "./fuzzy-search";

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

  test("applies limits while preserving empty-query browse order", () => {
    expect(
      fuzzySearch(accounts, "", { keys: ["label", "keywords"], limit: 2 }),
    ).toEqual(accounts.slice(0, 2));
  });

  test("matches labels and metadata despite minor typos", () => {
    expect(
      fuzzySearch(accounts, "pggy bk", {
        keys: [{ name: "label", weight: 2 }, "keywords"],
      }).map((account) => account.label),
    ).toEqual(["Savings"]);
  });

  test("returns relevance scores and source indexes for ranked matches", () => {
    const results = fuzzySearchWithScores(accounts, "travel", {
      keys: [{ name: "label", weight: 3 }, "keywords"],
    });

    expect(results[0]).toMatchObject({
      item: accounts[2],
      refIndex: 2,
    });
    expect(results[0]?.score).toBeTypeOf("number");
  });

  test("honours result limits without changing relevance ordering", () => {
    expect(
      fuzzySearch(accounts, "a", {
        keys: ["label", "keywords"],
        limit: 2,
      }),
    ).toHaveLength(2);
  });
});
