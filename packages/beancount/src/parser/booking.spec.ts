import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "../core/amount";
import { Booking, Open, Posting, Transaction } from "../core/data";
import { defaultBeancountOptions } from "../core/options";
import { Inventory } from "../core/inventory";
import { Cost, CostSpec, Position } from "../core/position";
import { book, validateMissingEliminated } from "./booking";

const account = "Assets:Investments";

function transaction(
  date: string,
  narration: string,
  postings: ReadonlyArray<Posting>,
) {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    "",
    narration,
    [],
    [],
    postings,
  );
}

describe("book", () => {
  test("uses an account AVERAGE booking method through the full booking pipeline", () => {
    const [entries, errors, balances] = book(
      [
        new Open(DateTime.fromISO("2020-01-01"), account, [], Booking.AVERAGE),
        transaction("2020-01-01", "Buy first lot", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new Cost(DateTime.fromISO("2020-01-01"), new Amount("10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
        ]),
        transaction("2021-01-01", "Buy second lot", [
          new Posting(
            account,
            new Amount("3", "HOOL"),
            new Cost(DateTime.fromISO("2021-01-01"), new Amount("20", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-60", "USD")),
        ]),
        transaction("2022-01-01", "Sell averaged lot", [
          new Posting(account, new Amount("-2", "HOOL"), new Cost()),
          new Posting("Assets:Cash", new Amount("35", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const sale = entries.at(-1) as Transaction;
    expect(sale.postings.slice(0, 3).map((posting) => posting.flag)).toEqual([
      "M",
      "M",
      "M",
    ]);
    const reduction = sale.postings[3];
    expect(reduction.flag).toBe("");
    expect(reduction.units?.toString()).toBe("-2 HOOL");
    expect(reduction.resolvedCost?.amount?.toString()).toBe("17.5 USD");
    expect(balances[account].toString()).toBe("(2 HOOL { 17.5 USD })");
  });

  test("falls back to the global booking method when no account method is set", () => {
    const [entries, errors] = book(
      [
        transaction("2020-01-01", "Buy first lot", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new Cost(DateTime.fromISO("2020-01-01"), new Amount("10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
        ]),
        transaction("2021-01-01", "Buy second lot", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new Cost(DateTime.fromISO("2021-01-01"), new Amount("20", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-20", "USD")),
        ]),
        transaction("2022-01-01", "Sell newest lot", [
          new Posting(account, new Amount("-1", "HOOL"), new Cost()),
          new Posting("Assets:Cash", new Amount("20", "USD")),
        ]),
      ],
      defaultBeancountOptions({ booking_method: Booking.LIFO }),
    );

    expect(errors).toEqual([]);
    const sale = entries.at(-1) as Transaction;
    expect(sale.postings[0].resolvedCost?.amount?.toString()).toBe("20 USD");
  });

  test("reduces against caller-supplied initial balances", () => {
    const initialBalances = {
      [account]: new Inventory(
        new Position(
          new Amount("1", "HOOL"),
          new Cost(DateTime.fromISO("2020-01-01"), new Amount("10", "USD")),
        ),
      ),
    };
    const [entries, errors, balances] = book(
      [
        transaction("2022-01-01", "Sell opening lot", [
          new Posting(account, new Amount("-1", "HOOL"), new Cost()),
          new Posting("Assets:Cash", new Amount("10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
      initialBalances,
    );

    expect(errors).toEqual([]);
    expect(
      (entries[0] as Transaction).postings[0].resolvedCost?.amount?.toString(),
    ).toBe("10 USD");
    expect(balances[account].isEmpty()).toBe(true);
  });

  test("reports transactions that retain incomplete resolved costs", () => {
    const incomplete = transaction("2022-01-01", "Missing lot date", [
      new Posting(
        account,
        new Amount("1", "HOOL"),
        new Cost(null, new Amount("10", "USD")),
      ),
      new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
    ]);

    const errors = validateMissingEliminated([incomplete]);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Transaction has incomplete elements");
    expect(errors[0].context.directive).toBe(incomplete);
  });

  test("resolves per-unit and total cost specifications without treating omitted components as missing", () => {
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Per-unit cost", [
          new Posting(
            account,
            new Amount("2", "HOOL"),
            new CostSpec(new Decimal("10"), null, "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-20", "USD")),
        ]),
        transaction("2022-01-02", "Total cost", [
          new Posting(
            "Assets:Other",
            new Amount("2", "HOOL"),
            new CostSpec(null, new Decimal("20"), "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-20", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const postings = entries
      .filter((entry): entry is Transaction => entry instanceof Transaction)
      .map((entry) => entry.postings[0]);
    expect(
      postings.map((posting) => posting.resolvedCost?.amount?.toString()),
    ).toEqual(["10 USD", "10 USD"]);
  });

  test("interpolates one missing unit amount and drops only a zero-residual auto-posting", () => {
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Infer cash", [
          new Posting("Expenses:Food", new Amount("5", "USD")),
          new Posting("Assets:Cash"),
        ]),
        transaction("2022-01-02", "Omit zero auto-posting", [
          new Posting("Expenses:Food", new Amount(0, "USD")),
          new Posting("Assets:Cash"),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const inferred = entries[0] as Transaction;
    expect(inferred.postings[1].units?.eq(new Amount("-5", "USD"))).toBe(true);
    expect(inferred.postings[1].meta.__automatic__).toBe(true);
    const zeroResidual = entries[1] as Transaction;
    expect(zeroResidual.postings).toHaveLength(1);
    expect(zeroResidual.postings[0].account).toBe("Expenses:Food");
  });

  test("reports an error instead of dividing by zero for total-cost-only unit interpolation", () => {
    const incomplete = transaction("2022-01-01", "Total cost without units", [
      new Posting(
        account,
        new Amount(null, "HOOL"),
        new CostSpec(Decimal.ZERO, new Decimal("10"), "USD"),
      ),
      new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
    ]);

    const [, errors] = book([incomplete], defaultBeancountOptions());

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe(
      "Cannot infer per-unit cost only from total",
    );
    expect((errors[0].context.directive as Posting).account).toBe(account);
  });

  test("reports multiple automatic postings before attempting interpolation", () => {
    const [, errors] = book(
      [
        transaction("2022-01-01", "Ambiguous automatic postings", [
          new Posting("Expenses:Food", new Amount("10", "USD")),
          new Posting("Assets:Cash"),
          new Posting("Liabilities:Card"),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors.map((error) => error.message)).toContain(
      "You may not have more than one auto-posting per currency",
    );
  });

  test("rejects zero-unit and negative-cost lots after interpolation", () => {
    const date = DateTime.fromISO("2022-01-01");
    const [, errors] = book(
      [
        transaction("2022-01-01", "Zero costed units", [
          new Posting(
            account,
            new Amount("0", "HOOL"),
            new Cost(date, new Amount("10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("0", "USD")),
        ]),
        transaction("2022-01-02", "Negative lot cost", [
          new Posting(
            "Assets:Other",
            new Amount("1", "HOOL"),
            new Cost(date, new Amount("-10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Amount is zero: "0 HOOL'),
        expect.stringContaining("Cost is negative:"),
      ]),
    );
  });
});
