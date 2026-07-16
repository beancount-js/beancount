import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Open, Posting, Transaction } from "../core";
import {
  CURRENCY_ACCOUNTS_META,
  insertCurrencyTradingPostings,
} from "./currency_accounts";

const date = DateTime.fromISO("2018-03-02");

function conversion() {
  return new Transaction(
    date,
    "*",
    "",
    "",
    [],
    [],
    [
      new Posting("Assets:Checking", new Amount("1200", "CAD")),
      new Posting(
        "Income:Salary",
        new Amount("-1000", "USD"),
        null,
        new Amount("1.2", "CAD"),
      ),
    ],
  );
}

describe("currency accounts plugin", () => {
  test("adds default currency account opens and neutralizing postings", () => {
    const [entries, errors] = insertCurrencyTradingPostings([
      new Open(DateTime.fromISO("2018-01-01"), "Assets:Checking"),
      new Open(DateTime.fromISO("2018-01-01"), "Income:Salary"),
      conversion(),
    ]);
    const transaction = entries.at(-1) as Transaction;

    expect(errors).toEqual([]);
    expect(entries.slice(0, 2).map((entry) => (entry as Open).account)).toEqual(
      ["Equity:CurrencyAccounts:CAD", "Equity:CurrencyAccounts:USD"],
    );
    expect(transaction.meta[CURRENCY_ACCOUNTS_META]).toBe(true);
    expect(
      transaction.postings.map((posting) => [
        posting.account,
        posting.units?.toString(),
        posting.price,
      ]),
    ).toEqual([
      ["Assets:Checking", "1200 CAD", null],
      ["Equity:CurrencyAccounts:CAD", "-1200 CAD", null],
      ["Income:Salary", "-1000 USD", null],
      ["Equity:CurrencyAccounts:USD", "1000 USD", null],
    ]);
  });

  test("uses a valid configured base account and leaves unpriced transactions untouched", () => {
    const plain = new Transaction(
      date,
      "*",
      "",
      "",
      [],
      [],
      [
        new Posting("Assets:Checking", new Amount("100", "USD")),
        new Posting("Income:Salary", new Amount("-100", "USD")),
      ],
    );
    const [entries] = insertCurrencyTradingPostings(
      [conversion(), plain],
      undefined,
      "Assets:TradingAccounts",
    );
    const converted = entries.find(
      (entry) => entry instanceof Transaction,
    ) as Transaction;
    const untouched = entries.at(-1) as Transaction;

    expect((entries[0] as Open).account).toBe("Assets:TradingAccounts:CAD");
    expect(converted.postings.at(-1)?.account).toBe(
      "Assets:TradingAccounts:USD",
    );
    expect(untouched).toBe(plain);
  });
});
