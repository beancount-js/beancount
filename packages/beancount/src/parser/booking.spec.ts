import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "../core/amount";
import { Booking, Open, Posting, Transaction } from "../core/data";
import { defaultBeancountOptions } from "../core/options";
import { Inventory } from "../core/inventory";
import { Cost, CostSpec, Position } from "../core/position";
import { book, validateMissingEliminated } from "./booking";
import { parseDirectives } from "./parser";

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

  test("interpolates missing commodity units from an explicit price", () => {
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Buy from price", [
          new Posting(
            account,
            new Amount(null, "HOOL"),
            null,
            new Amount("10", "USD"),
          ),
          new Posting("Assets:Cash", new Amount("-20", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const units = (entries[0] as Transaction).postings[0].units;
    expect(units?.eq(new Amount("2", "HOOL"))).toBe(true);
    expect(units?.currency).toBe("HOOL");
  });

  test("interpolates a missing price and rejects price interpolation for costed units", () => {
    // Ported from Beancount's booking_full_test.py::test_incomplete_price.
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Infer price", [
          new Posting(
            account,
            new Amount("125", "CAD"),
            null,
            new Amount(null, "USD"),
          ),
          new Posting("Assets:Cash", new Amount("-100", "USD")),
        ]),
        transaction("2022-01-02", "Reject price on costed units", [
          new Posting(
            account,
            new Amount("10", "HOOL"),
            new CostSpec(new Decimal("100"), new Decimal("9.95"), "USD"),
            new Amount(null, "USD"),
          ),
          new Posting("Assets:Cash", new Amount("-1009.95", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect((entries[0] as Transaction).postings[0].price?.eq("0.8")).toBe(true);
    expect((entries[0] as Transaction).postings[0].price?.currency).toBe("USD");
    expect(errors.map((error) => error.message)).toContain(
      "Cannot infer price for postings with units held at cost",
    );
  });

  test("interpolates a missing per-unit cost from the transaction residual", () => {
    // Ported from Beancount's booking_full_test.py::test_incomplete_cost_per.
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Infer cost per unit", [
          new Posting(
            account,
            new Amount("10", "HOOL"),
            new CostSpec(null, new Decimal("9.95"), "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-1009.95", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    expect(
      (entries[0] as Transaction).postings[0].resolvedCost?.amount?.eq(
        new Amount("100.995", "USD"),
      ),
    ).toBe(true);
  });

  test("interpolates a parser-marked missing total cost", () => {
    // Ported from Beancount's booking_full_test.py::test_incomplete_cost_total.
    const [parsed, parseErrors] = parseDirectives(`
      2022-01-01 * "Infer total cost"
        Assets:Investments  10 HOOL {100 # USD}
        Equity:Opening-Balances -1009.95 USD
    `);
    expect(parseErrors).toEqual([]);

    const [entries, errors] = book(parsed, defaultBeancountOptions());

    expect(errors).toEqual([]);
    expect(
      (entries[0] as Transaction).postings[0].resolvedCost?.amount?.eq(
        new Amount("100.995", "USD"),
      ),
    ).toBe(true);
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

  test("reports an unmatched reduction against an existing costed lot", () => {
    const date = DateTime.fromISO("2022-01-01");
    const [, errors] = book(
      [
        transaction("2022-01-01", "Buy", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new Cost(date, new Amount("10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
        ]),
        transaction("2022-01-02", "Mismatched sale", [
          new Posting(
            account,
            new Amount("-1", "HOOL"),
            new Cost(date, new Amount("20", "USD")),
          ),
          new Posting("Assets:Cash", new Amount("20", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(
      errors.some((error) => error.message.includes("No position matches")),
    ).toBe(true);
  });

  test("does not match a costed reduction against an uncosted inventory position", () => {
    // Ported from Beancount's booking_full_test.py::test_reduce__reduction_with_same_currency_not_at_cost.
    const balances = {
      [account]: new Inventory(new Position(new Amount("1", "HOOL"))),
    };
    const [, errors] = book(
      [
        transaction("2022-01-02", "Sell costed lot", [
          new Posting(
            account,
            new Amount("-1", "HOOL"),
            new Cost(null, new Amount("10", "USD")),
          ),
        ]),
      ],
      defaultBeancountOptions(),
      balances,
    );

    expect(errors[0].message).toContain("No position matches");
    expect(balances[account].positions).toHaveLength(1);
  });

  test("reports a CostSpec with both unresolved cost components", () => {
    const [, errors] = book(
      [
        transaction("2022-01-01", "Ambiguous cost", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new CostSpec(null, null, "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(
      errors.some((error) =>
        error.message.includes(
          "Too many missing numbers for currency group 'USD'",
        ),
      ),
    ).toBe(true);
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

  test("allows independent costed lots when the account uses NONE booking", () => {
    const [entries, errors, balances] = book(
      [
        new Open(DateTime.fromISO("2022-01-01"), account, [], Booking.NONE),
        transaction("2022-01-01", "Buy", [
          new Posting(
            account,
            new Amount("1", "HOOL"),
            new Cost(null, new Amount("10", "USD")),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
        ]),
        transaction("2022-01-02", "Independent reduction", [
          new Posting(
            account,
            new Amount("-1", "HOOL"),
            new Cost(null, new Amount("20", "USD")),
          ),
          new Posting("Assets:Cash", new Amount("20", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    expect(
      (entries[2] as Transaction).postings[0].resolvedCost?.date?.toISODate(),
    ).toBe("2022-01-02");
    expect(balances[account].isEmpty()).toBe(false);
  });

  test("reports unresolved postings that cannot be assigned to a currency group", () => {
    const incomplete = transaction("2022-01-01", "Unknown currency", [
      new Posting("Assets:Cash", new Amount(null, null)),
    ]);

    const [entries, errors] = book([incomplete], defaultBeancountOptions());

    expect(entries).toEqual([]);
    expect(errors.map((error) => error.message)).toContain(
      "Failed to categorize posting 0",
    );
  });

  test("reports each explicit null currency in a partially known posting", () => {
    const [, errors] = book(
      [
        transaction("2022-01-01", "Missing units currency", [
          new Posting(
            "Assets:Units",
            new Amount("1", null),
            null,
            new Amount("1", "USD"),
          ),
        ]),
        transaction("2022-01-02", "Missing cost currency", [
          new Posting(
            "Assets:Cost",
            new Amount("1", "HOOL"),
            new CostSpec(new Decimal("1"), null, null),
          ),
        ]),
        transaction("2022-01-03", "Missing price currency", [
          new Posting(
            "Assets:Price",
            new Amount("1", "HOOL"),
            null,
            new Amount("1", null),
          ),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        "Could not resolve units currency",
        "Could not resolve cost currency",
        "Could not resolve price currency",
      ]),
    );
  });

  test("infers an omitted units currency from the other posting", () => {
    // Ported from Beancount's booking_full_test.py::test_categorize__units__ambiguous.
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Infer units currency", [
          new Posting("Assets:Account", new Amount("100", null)),
          new Posting("Assets:Other", new Amount("-100", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    expect((entries[0] as Transaction).postings[0].units?.currency).toBe("USD");
  });

  test("inserts one automatic residual posting for each currency group", () => {
    // Ported from Beancount's booking_full_test.py::test_categorize__multiple_auto_postings.
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Balance two currencies", [
          new Posting("Assets:Account", new Amount("100", "USD")),
          new Posting("Assets:Account", new Amount("200", "CAD")),
          new Posting("Equity:Opening-Balances"),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const postings = (entries[0] as Transaction).postings;
    expect(postings.map((posting) => posting.account)).toEqual([
      "Assets:Account",
      "Equity:Opening-Balances",
      "Assets:Account",
      "Equity:Opening-Balances",
    ]);
    expect(postings[1].units?.eq(new Amount("-100", "USD"))).toBe(true);
    expect(postings[3].units?.eq(new Amount("-200", "CAD"))).toBe(true);
  });

  test("fills missing cost and price currencies from their currency group", () => {
    // Ported from Beancount's booking_full_test.py::TestReplaceCurrenciesInGroup.test_missing.
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Infer cost currency", [
          new Posting(
            "Assets:Cost",
            new Amount("10", "HOOL"),
            new CostSpec(new Decimal("10"), null, null),
            new Amount("12", "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-100", "USD")),
        ]),
        transaction("2022-01-02", "Infer price currency", [
          new Posting(
            "Assets:Price",
            new Amount("10", "HOOL"),
            new CostSpec(new Decimal("10"), null, "USD"),
            new Amount("12", null),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-100", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    const [costPosting, pricePosting] = entries.map(
      (entry) => (entry as Transaction).postings[0],
    );
    expect(costPosting.resolvedCost?.amount?.currency).toBe("USD");
    expect(pricePosting.price?.currency).toBe("USD");
  });

  test("filters candidate lots by every specified reduction attribute", () => {
    const wantedDate = DateTime.fromISO("2022-01-01");
    const balances = {
      [account]: new Inventory(
        new Position(new Amount("1", "AAPL"), null),
        new Position(new Amount("1", "HOOL"), null),
        new Position(
          new Amount("1", "HOOL"),
          new Cost(wantedDate, new Amount("5", "USD"), "wanted"),
        ),
        new Position(
          new Amount("1", "HOOL"),
          new Cost(wantedDate, new Amount("10", "EUR"), "wanted"),
        ),
        new Position(
          new Amount("1", "HOOL"),
          new Cost(
            DateTime.fromISO("2021-01-01"),
            new Amount("10", "USD"),
            "wanted",
          ),
        ),
        new Position(
          new Amount("1", "HOOL"),
          new Cost(wantedDate, new Amount("10", "USD"), "other"),
        ),
        new Position(
          new Amount("1", "HOOL"),
          new Cost(wantedDate, new Amount("10", "USD"), "wanted"),
        ),
      ),
    };
    const [entries, errors] = book(
      [
        transaction("2023-01-01", "Sell exact lot", [
          new Posting(
            account,
            new Amount("-1", "HOOL"),
            new Cost(wantedDate, new Amount("10", "USD"), "wanted"),
          ),
          new Posting("Assets:Cash", new Amount("10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
      balances,
    );

    expect(errors).toEqual([]);
    expect((entries[0] as Transaction).postings[0].resolvedCost?.label).toBe(
      "wanted",
    );
    expect(balances[account].positions).toHaveLength(6);
  });

  test("reports ambiguous strict reductions through the booking pipeline", () => {
    // Ported from Beancount's booking_full_test.py::test_reduce__ambiguous__strict.
    const date = DateTime.fromISO("2022-01-01");
    const balances = {
      [account]: new Inventory(
        new Position(
          new Amount("10", "HOOL"),
          new Cost(date, new Amount("115", "USD"), "lot-1"),
        ),
        new Position(
          new Amount("10", "HOOL"),
          new Cost(date, new Amount("115", "USD"), "lot-2"),
        ),
      ),
    };
    const [, errors] = book(
      [
        transaction("2022-05-02", "Ambiguous sale", [
          new Posting(account, new Amount("-5", "HOOL"), new Cost()),
        ]),
      ],
      defaultBeancountOptions({ booking_method: Booking.STRICT }),
      balances,
    );

    expect(errors[0].message).toContain("Ambiguous matches");
    expect(balances[account].positions).toHaveLength(2);
  });

  test("books sequential reductions against the transaction-local FIFO balance", () => {
    // Ported from Beancount's booking_full_test.py::test_reduce__multiple_reductions.
    const firstDate = DateTime.fromISO("2022-01-15");
    const secondDate = DateTime.fromISO("2022-01-16");
    const balances = {
      [account]: new Inventory(
        new Position(
          new Amount("50", "HOOL"),
          new Cost(firstDate, new Amount("115", "USD")),
        ),
        new Position(
          new Amount("50", "HOOL"),
          new Cost(secondDate, new Amount("116", "USD")),
        ),
      ),
    };
    const [entries, errors] = book(
      [
        transaction("2022-05-02", "Sell multiple lots", [
          new Posting(account, new Amount("-40", "HOOL"), new Cost()),
          new Posting(account, new Amount("-35", "HOOL"), new Cost()),
        ]),
      ],
      defaultBeancountOptions({ booking_method: Booking.FIFO }),
      balances,
    );

    expect(errors).toEqual([]);
    const postings = (entries[0] as Transaction).postings;
    expect(postings.map((posting) => posting.units?.toString())).toEqual([
      "-40 HOOL",
      "-10 HOOL",
      "-25 HOOL",
    ]);
    expect(
      postings.map((posting) => posting.resolvedCost?.amount?.toString()),
    ).toEqual(["115 USD", "115 USD", "116 USD"]);
    expect(balances[account].toString()).toBe("(25 HOOL { 116 USD })");
  });

  test("resolves a strict reduction when matching lots exactly satisfy it", () => {
    // Ported from Beancount's booking_full_test.py::test_reduce__multiple_reductions__no_error_because_total.
    const balances = {
      [account]: new Inventory(
        new Position(
          new Amount("7", "HOOL"),
          new Cost(DateTime.fromISO("2022-01-15"), new Amount("115", "USD")),
        ),
        new Position(
          new Amount("4", "HOOL"),
          new Cost(DateTime.fromISO("2022-01-16"), new Amount("115", "USD")),
        ),
        new Position(
          new Amount("3", "HOOL"),
          new Cost(DateTime.fromISO("2022-01-15"), new Amount("117", "USD")),
        ),
      ),
    };
    const [entries, errors] = book(
      [
        transaction("2022-05-02", "Sell exact matched total", [
          new Posting(
            account,
            new Amount("-11", "HOOL"),
            new Cost(null, new Amount("115", "USD")),
          ),
        ]),
      ],
      defaultBeancountOptions({ booking_method: Booking.STRICT }),
      balances,
    );

    expect(errors).toEqual([]);
    const postings = (entries[0] as Transaction).postings;
    expect(postings.map((posting) => posting.units?.toString())).toEqual([
      "-7 HOOL",
      "-4 HOOL",
    ]);
    expect(balances[account].toString()).toBe("(3 HOOL { 117 USD })");
  });

  test("infers a reduction currency from an account with one held commodity", () => {
    const heldCost = new Cost(
      DateTime.fromISO("2022-01-01"),
      new Amount("10", "USD"),
    );
    const balances = {
      [account]: new Inventory(new Position(new Amount("1", "HOOL"), heldCost)),
    };
    const [entries, errors] = book(
      [
        transaction("2022-01-02", "Sell inferred commodity", [
          new Posting(
            account,
            new Amount("-1", null),
            new Cost(null, new Amount("10", "USD")),
          ),
          new Posting("Assets:Cash", new Amount("10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
      balances,
    );

    expect(errors).toEqual([]);
    expect((entries[0] as Transaction).postings[0].units?.currency).toBe(
      "HOOL",
    );
  });

  test("infers cost and price currencies from a single held cost currency", () => {
    const balances = {
      [account]: new Inventory(
        new Position(
          new Amount("1", "HOOL"),
          new Cost(DateTime.fromISO("2022-01-01"), new Amount("10", "USD")),
        ),
      ),
    };
    const [entries, errors] = book(
      [
        transaction("2022-01-02", "Sell inferred lot currencies", [
          new Posting(
            account,
            new Amount("-1", null),
            new CostSpec(new Decimal("10"), null, null),
          ),
          new Posting("Assets:Cash", new Amount("10", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
      balances,
    );

    expect(errors).toEqual([]);
    const posting = (entries[0] as Transaction).postings[0];
    expect(posting.units?.currency).toBe("HOOL");
    expect(posting.resolvedCost?.amount?.currency).toBe("USD");
  });

  test("uses the held inventory to categorize an otherwise unknown reduction", () => {
    // Ported from Beancount's booking_full_test.py::test_categorize__two_unknown_postings.
    const balances = {
      [account]: new Inventory(
        new Position(
          new Amount("1", "HOOL"),
          new Cost(DateTime.fromISO("2022-01-01"), new Amount("10", "USD")),
        ),
      ),
    };
    const [entries, errors] = book(
      [
        transaction("2022-01-02", "Infer from held lot", [
          new Posting(
            account,
            new Amount("-1", null),
            new CostSpec(new Decimal("10"), null, null),
          ),
        ]),
      ],
      defaultBeancountOptions(),
      balances,
    );

    expect(errors).toEqual([]);
    const posting = (entries[0] as Transaction).postings[0];
    expect(posting.units?.currency).toBe("HOOL");
    expect(posting.resolvedCost?.amount?.currency).toBe("USD");
    expect(balances[account].isEmpty()).toBe(true);
  });

  test("combines per-unit and total cost specifications during augmentation", () => {
    const [entries, errors] = book(
      [
        transaction("2022-01-01", "Combined cost", [
          new Posting(
            account,
            new Amount("2", "HOOL"),
            new CostSpec(new Decimal("10"), new Decimal("10"), "USD"),
          ),
          new Posting("Equity:Opening-Balances", new Amount("-30", "USD")),
        ]),
      ],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    expect(
      (entries[0] as Transaction).postings[0].resolvedCost?.amount?.toString(),
    ).toBe("15 USD");
  });

  test("flags missing units, currencies, and resolved cost details", () => {
    const invalid = transaction("2022-01-01", "Incomplete fields", [
      new Posting("Assets:Missing-Units"),
      new Posting("Assets:Missing-Currency", new Amount("1", null)),
      new Posting(
        "Assets:Cost-Spec",
        new Amount("1", "HOOL"),
        new CostSpec(new Decimal("10"), null, "USD"),
      ),
      new Posting(
        "Assets:Cost-Amount",
        new Amount("1", "HOOL"),
        new Cost(DateTime.fromISO("2022-01-01"), new Amount(null, "USD")),
      ),
      new Posting(
        "Assets:Cost-Currency",
        new Amount("1", "HOOL"),
        new Cost(DateTime.fromISO("2022-01-01"), new Amount("10", null)),
      ),
      new Posting(
        "Assets:Cost-Date",
        new Amount("1", "HOOL"),
        new Cost(null, new Amount("10", "USD")),
      ),
    ]);

    const errors = validateMissingEliminated([invalid]);

    expect(errors).toHaveLength(1);
    expect(errors[0].context.directive).toBe(invalid);
  });
});
