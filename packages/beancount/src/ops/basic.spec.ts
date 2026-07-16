import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Posting, Transaction } from "../core";
import {
  filterLink,
  filterTag,
  getCommonAccounts,
  groupEntriesByLink,
} from "./basic";

function transaction(
  narration: string,
  tags: string[] = [],
  links: string[] = [],
  accounts: string[] = ["Assets:Cash", "Expenses:Food"],
) {
  return new Transaction(
    DateTime.fromISO("2024-01-01"),
    "*",
    "",
    narration,
    tags,
    links,
    accounts.map(
      (account, index) =>
        new Posting(account, new Amount(index ? "-1" : "1", "USD")),
    ),
  );
}

describe("basic operations", () => {
  test("filters and groups transactions by exact tags and links", () => {
    const food = transaction("Food", ["food"], ["receipt", "weekly"]);
    const rent = transaction("Rent", ["home"], ["weekly"]);
    const entries = [food, rent];

    expect(filterTag(entries, "food")).toEqual([food]);
    expect(filterLink(entries, "weekly")).toEqual([food, rent]);
    expect(groupEntriesByLink(entries)).toEqual(
      new Map([
        ["receipt", [food]],
        ["weekly", [food, rent]],
      ]),
    );
  });

  test("finds accounts common to every directive", () => {
    const first = transaction("First");
    const second = transaction(
      "Second",
      [],
      [],
      ["Assets:Cash", "Income:Salary"],
    );

    expect(getCommonAccounts([first, second])).toEqual(
      new Set(["Assets:Cash"]),
    );
    expect(getCommonAccounts([])).toEqual(new Set());
  });
});
