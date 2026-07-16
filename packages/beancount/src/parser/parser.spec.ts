import { describe, test, expect } from "vitest";
import { parseDirectives } from "./parser";
import {
  Balance,
  Commodity,
  Custom,
  Document,
  Event,
  LedgerInclude,
  LedgerOption,
  Note,
  Open,
  Pad,
  Plugin,
  Price,
  Query,
  Transaction,
} from "../core";

describe("LedgerParser", () => {
  test("parseDirectives", () => {
    const input = `
    2013-05-18 * ""
      Assets:Investments:MSFT      0 MSFT {200.00 USD}
      Assets:Investments:Cash      0 USD
    `;
    const [entries, errors] = parseDirectives(input);
    expect(errors).toEqual([]);
    expect(entries.length).toEqual(1);
    expect(entries[0].toString()).toMatchDirective(`
        2013-05-18 * 
          Assets:Investments:MSFT      0 MSFT { 200.00 USD, 2013-05-18 }
          Assets:Investments:Cash      0 USD
        `);
  });

  test("process includes", () => {
    const input = `
    include "budget.ledger"

    2013-05-18 * ""
      Assets:Investments:MSFT      0 MSFT {200.00 USD}
      Assets:Investments:Cash      0 USD
    `;
    const [entries, errors, _, parser] = parseDirectives(input);
    expect(parser.sources).toEqual(["budget.ledger"]);
    expect(errors).toEqual([]);
    expect(entries.length).toEqual(2);
  });

  test("converts every directive family, metadata, expressions, and pushed tags", () => {
    const [entries, errors, options] = parseDirectives(`
      option "operating_currency" "USD"
      option "operating_currency" "EUR"
      include "included.bean"
      plugin "beancount.plugins.auto_account" "config"
      pushtag #trip
      2024-01-01 open Assets:Cash USD,EUR FIFO
        account_type: "cash"
      2024-01-02 commodity HOOL
      2024-01-03 pad Assets:Cash Equity:Opening-Balances
      2024-01-04 balance Assets:Cash 1 + 2 USD
      2024-01-05 note Assets:Cash "Reviewed" #note ^receipt
      2024-01-06 event "location" "London"
      2024-01-07 query "balances" "SELECT 1"
      2024-01-08 custom "budget" "Travel" TRUE 45.30 USD 2024-01-01
      2024-01-09 price HOOL 10 USD
      2024-01-10 document Assets:Cash "statement.pdf" #statement
      2024-01-11 * "Store" "Purchase" #food ^invoice
        category: "groceries"
        Assets:Cash -2 * 3 USD {10 USD} @ 60 USD
          quantity: 2 + 3
        Expenses:Food 6 USD
      poptag #trip
    `);

    expect(errors).toEqual([]);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.any(LedgerOption),
        expect.any(LedgerInclude),
        expect.any(Plugin),
        expect.any(Open),
        expect.any(Commodity),
        expect.any(Pad),
        expect.any(Balance),
        expect.any(Note),
        expect.any(Event),
        expect.any(Query),
        expect.any(Custom),
        expect.any(Price),
        expect.any(Document),
        expect.any(Transaction),
      ]),
    );
    expect(options.operating_currency).toEqual(["USD", "EUR"]);

    const transaction = entries.find(
      (entry): entry is Transaction => entry instanceof Transaction,
    )!;
    expect(transaction.tags).toEqual(["food", "trip"]);
    expect(transaction.links).toEqual(["invoice"]);
    expect(transaction.meta.category).toBe("groceries");
    expect(transaction.postings[0].units?.toString()).toBe("-6 USD");
    expect(transaction.postings[0].resolvedCost?.amount?.toString()).toBe(
      "10 USD",
    );
    expect(transaction.postings[0].price?.toString()).toBe("60 USD");
    expect(transaction.postings[0].meta.quantity?.toString()).toBe("5");
  });
});
