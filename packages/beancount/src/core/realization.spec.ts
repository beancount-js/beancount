import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import { Open, Posting, Transaction, TxnPosting } from "./data";
import {
  filterRealAccounts,
  findLastActivePosting,
  getPostings,
  iterateWithBalance,
  realize,
} from "./realization";

const firstDate = DateTime.fromISO("2024-01-01");
const secondDate = DateTime.fromISO("2024-01-02");

function transaction(
  date: DateTime,
  narration: string,
  postings: Posting[],
): Transaction {
  return new Transaction(date, "*", "", narration, [], [], postings);
}

describe("realization", () => {
  test("realizes postings into an ordered account tree with balances", () => {
    const purchase = transaction(firstDate, "Purchase", [
      new Posting("Assets:Cash", new Amount("10", "USD")),
      new Posting("Income:Salary", new Amount("-10", "USD")),
    ]);
    const root = realize([purchase], ["Expenses", "Liabilities:Card"]);

    expect([...root.traverse()].map((account) => account.account)).toEqual([
      "",
      "Assets",
      "Assets:Cash",
      "Expenses",
      "Income",
      "Income:Salary",
      "Liabilities",
      "Liabilities:Card",
    ]);
    expect(root.get("Assets:Cash")?.balance.currencyUnits("USD")).toEqual(
      new Amount("10", "USD"),
    );
    expect(root.get("Assets")?.computeBalance().currencyUnits("USD")).toEqual(
      new Amount("10", "USD"),
    );
  });

  test("filters account trees without mutating their balances or entries", () => {
    const root = realize([
      transaction(firstDate, "Purchase", [
        new Posting("Assets:Cash", new Amount("10", "USD")),
        new Posting("Income:Salary", new Amount("-10", "USD")),
      ]),
    ]);
    const assets = filterRealAccounts(root, (account) =>
      account.account.startsWith("Assets"),
    );

    expect([...assets!.traverse()].map((account) => account.account)).toEqual([
      "",
      "Assets",
      "Assets:Cash",
    ]);
    expect(getPostings(assets!).map((entry) => entry.constructor.name)).toEqual(
      ["TxnPosting"],
    );
  });

  test("iterates grouped postings with running balances", () => {
    const first = transaction(firstDate, "First", [
      new Posting("Assets:Cash", new Amount("10", "USD")),
    ]);
    const second = transaction(secondDate, "Second", [
      new Posting("Assets:Cash", new Amount("-3", "USD")),
    ]);
    const open = new Open(firstDate, "Assets:Cash");
    const entries = [
      open,
      new TxnPosting(first, first.postings[0]),
      new TxnPosting(second, second.postings[0]),
    ];

    const iterations = [...iterateWithBalance(entries)];
    expect(iterations).toHaveLength(3);
    expect(iterations[1][1]).toHaveLength(1);
    expect(iterations[1][3].currencyUnits("USD")).toEqual(
      new Amount("10", "USD"),
    );
    expect(iterations[2][3].currencyUnits("USD")).toEqual(
      new Amount("7", "USD"),
    );
    expect(findLastActivePosting(entries)).toBe(entries[2]);
  });
});
