import { describe, test, expect } from "vitest";
import { loadString } from "../parser/loader";
import { DateTime } from "luxon";
import { clear, close, open, summarize } from "./summarize";
import {
  AccountTypes,
  Amount,
  computeEntriesBalance,
  LedgerOption,
  Price,
} from "../core";

describe("TestOpenClose", () => {
  const INPUT = `
        option "account_previous_earnings"    "Earnings:Previous"
        option "account_previous_balances"    "Opening-Balances"
        option "account_previous_conversions" "Conversions:Previous"

        option "account_current_earnings"     "Earnings:Current"
        option "account_current_conversions"  "Conversions:Current"
        option "conversion_currency"          "NOTHING"

        2012-01-01 open Income:Salary
        2012-01-01 open Expenses:Taxes
        2012-01-01 open Assets:US:Checking
        2012-01-01 open Assets:CA:Checking

        2012-03-01 * "Some income and expense to be summarized"
          Income:Salary        10000 USD
          Expenses:Taxes        3600 USD
          Assets:US:Checking  -13600 USD

        2012-03-02 * "Some conversion to be summarized"
          Assets:US:Checking   -5000 USD @ 1.2 CAD
          Assets:CA:Checking    6000 CAD

        ;; 2012-06-01  BEGIN --------------------------------

        2012-08-01 * "Some income and expense to show"
          Income:Salary        11000 USD
          Expenses:Taxes        3200 USD
          Assets:US:Checking  -14200 USD

        2012-08-02 * "Some other conversion to be summarized"
          Assets:US:Checking   -3000 USD @ 1.25 CAD
          Assets:CA:Checking    3750 CAD

        ;; 2012-09-01  END   --------------------------------

        2012-11-01 * "Some income and expense to be truncated"
          Income:Salary        10000 USD
          Expenses:Taxes        3600 USD
          Assets:US:Checking  -13600 USD
    `;
  const [directives, errors, options] = loadString(INPUT);
  const accountTypes = new AccountTypes(options);
  expect(errors).toEqual([]);

  test("clear", () => {
    const date = DateTime.fromObject({ year: 2013, month: 1, day: 1 });
    const [clearEntries, index] = clear(
      directives,
      date,
      accountTypes,
      "Equity:Earnings:Current",
    );
    expect(clearEntries).toMatchDirective(`
            2012-01-01 open Income:Salary
            2012-01-01 open Expenses:Taxes
            2012-01-01 open Assets:US:Checking
            2012-01-01 open Assets:CA:Checking

            2012-03-01 * "Some income and expense to be summarized"
            Income:Salary        10000 USD
            Expenses:Taxes        3600 USD
            Assets:US:Checking  -13600 USD

            2012-03-02 * "Some conversion to be summarized"
            Assets:US:Checking   -5000 USD @ 1.2 CAD
            Assets:CA:Checking    6000 CAD

            ;; 2012-06-01  BEGIN --------------------------------

            2012-08-01 * "Some income and expense to show"
            Income:Salary        11000 USD
            Expenses:Taxes        3200 USD
            Assets:US:Checking  -14200 USD

            2012-08-02 * "Some other conversion to be summarized"
            Assets:US:Checking   -3000 USD @ 1.25 CAD
            Assets:CA:Checking    3750 CAD

            ;; 2012-09-01  END   --------------------------------

            2012-11-01 * "Some income and expense to be truncated"
            Income:Salary        10000 USD
            Expenses:Taxes        3600 USD
            Assets:US:Checking  -13600 USD

            2012-12-31 T "Transfer balance for 'Expenses:Taxes' (Transfer balance)"
            Expenses:Taxes           -10400 USD
            Equity:Earnings:Current   10400 USD

            2012-12-31 T "Transfer balance for 'Income:Salary' (Transfer balance)"
            Income:Salary             -31000 USD
            Equity:Earnings:Current    31000 USD    
        `);

    expect(index).toEqual(15);
  });

  test("open", () => {
    const date = DateTime.fromObject({ year: 2012, month: 6, day: 1 });
    const [openEntries, index] = open(
      directives,
      date,
      accountTypes,
      "NOTHING",
      "Equity:Earnings:Previous",
      "Equity:Opening-Balances",
      "Equity:Conversions:Previous",
    );

    expect(openEntries).toMatchDirective(`
            2012-01-01 open Income:Salary
            2012-01-01 open Expenses:Taxes
            2012-01-01 open Assets:US:Checking
            2012-01-01 open Assets:CA:Checking

            2012-05-31 S "Opening balance for 'Assets:CA:Checking' (Summarization)"
            Assets:CA:Checking             6,000 CAD
            Equity:Opening-Balances       -6,000 CAD

            2012-05-31 S "Opening balance for 'Assets:US:Checking' (Summarization)"
            Assets:US:Checking           -18,600 USD
            Equity:Opening-Balances       18,600 USD

            2012-05-31 S "Opening balance for 'Equity:Earnings:Previous' (Summarization)"
            Equity:Earnings:Previous      13,600 USD
            Equity:Opening-Balances      -13,600 USD

            2012-05-31 S "Opening balance for 'Equity:Conversions:Previous' (Summarization)"
            Equity:Conversions:Previous    5,000 USD
            Equity:Opening-Balances       -5,000 USD
            Equity:Conversions:Previous   -6,000 CAD
            Equity:Opening-Balances        6,000 CAD

            ;; 2012-06-01  BEGIN --------------------------------

            2012-08-01 * "Some income and expense to show"
            Income:Salary                 11,000 USD
            Expenses:Taxes                 3,200 USD
            Assets:US:Checking           -14,200 USD

            2012-08-02 * "Some other conversion to be summarized"
            Assets:US:Checking            -3,000 USD @ 1.25 CAD ;  -3,750 CAD
            Assets:CA:Checking             3,750 CAD            ;   3,750 CAD

            2012-11-01 * "Some income and expense to be truncated"
            Income:Salary                 10,000 USD
            Expenses:Taxes                 3,600 USD
            Assets:US:Checking           -13,600 USD    
        `);

    expect(index).toBe(8);

    // Check that our original example list of entries does not balance.
    let balances = computeEntriesBalance(directives);
    expect(balances.isEmpty()).toBe(false);

    // Check that the summarized entries add up to precisely zero.
    balances = computeEntriesBalance(openEntries.slice(undefined, index));
    expect(balances.isEmpty()).toBe(true);

    // Check further conversions aren't accounted for (the close operation takes care of this).
    balances = computeEntriesBalance(openEntries);
    expect(balances.isEmpty()).toBe(false);
  });

  test("close", () => {
    const date = DateTime.fromObject({ year: 2012, month: 9, day: 1 });
    const [closedEntries, index] = close(
      directives,
      date,
      "NOTHING",
      "Equity:Conversions:Current",
    );
    expect(closedEntries).toMatchDirective(`
            2012-01-01 open Income:Salary
            2012-01-01 open Expenses:Taxes
            2012-01-01 open Assets:US:Checking
            2012-01-01 open Assets:CA:Checking

            2012-03-01 * "Some income and expense to be summarized"
            Income:Salary        10000 USD
            Expenses:Taxes        3600 USD
            Assets:US:Checking  -13600 USD

            2012-03-02 * "Some conversion to be summarized"
            Assets:US:Checking   -5000 USD @ 1.2 CAD
            Assets:CA:Checking    6000 CAD

            ;; 2012-06-01  BEGIN --------------------------------

            2012-08-01 * "Some income and expense to show"
            Income:Salary        11000 USD
            Expenses:Taxes        3200 USD
            Assets:US:Checking  -14200 USD

            2012-08-02 * "Some other conversion to be summarized"
            Assets:US:Checking   -3000 USD @ 1.25 CAD
            Assets:CA:Checking    3750 CAD

            ;; 2012-09-01  END   --------------------------------

            2012-08-31 C "Conversion for (-8000 USD, 9750 CAD)"
            Equity:Conversions:Current    8000 USD  @ 0 NOTHING
            Equity:Conversions:Current   -9750 CAD  @ 0 NOTHING
        `);
    //  Check the index is correctly beginning after the list of summarizing entries.
    expect(index).toBe(14);

    // Check that our original example list of entries does not balance.
    let balances = computeEntriesBalance(directives);
    expect(balances.isEmpty()).toBe(false);

    // Check that the truncated entries does not balance.
    balances = computeEntriesBalance(closedEntries.slice(undefined, index));
    expect(balances.isEmpty()).toBe(false);

    // Check that the closed entries add up to precisely zero.
    balances = computeEntriesBalance(closedEntries);
    expect(balances.isEmpty()).toBe(true);
  });

  test("open/close/clear", () => {
    const beginDate = DateTime.fromObject({ year: 2012, month: 6, day: 1 });
    const endDate = DateTime.fromObject({ year: 2012, month: 9, day: 1 });
    const clearDate = DateTime.fromObject({ year: 2013, month: 1, day: 1 });

    const [openEntries] = open(
      directives,
      beginDate,
      accountTypes,
      "NOTHING",
      "Equity:Earnings:Previous",
      "Equity:Opening-Balances",
      "Equity:Conversions:Previous",
    );

    const [closedEntries] = close(
      openEntries,
      endDate,
      "NOTHING",
      "Equity:Conversions:Current",
    );
    const [clearEntries] = clear(
      closedEntries,
      clearDate,
      accountTypes,
      "Equity:Earnings:Current",
    );
    expect(clearEntries).toMatchDirective(`
            2012-01-01 open Income:Salary
            2012-01-01 open Expenses:Taxes
            2012-01-01 open Assets:US:Checking
            2012-01-01 open Assets:CA:Checking

            2012-05-31 S "Opening balance for 'Assets:CA:Checking' (Summarization)"
            Assets:CA:Checking            6,000 CAD
            Equity:Opening-Balances      -6,000 CAD

            2012-05-31 S "Opening balance for 'Assets:US:Checking' (Summarization)"
            Assets:US:Checking          -18,600 USD
            Equity:Opening-Balances      18,600 USD

            2012-05-31 S "Opening balance for 'Equity:Earnings:Previous' (Summarization)"
            Equity:Earnings:Previous     13,600 USD
            Equity:Opening-Balances     -13,600 USD

            2012-05-31 S "Opening balance for 'Equity:Conversions:Previous' (Summarization)"
            Equity:Conversions:Previous   5,000 USD
            Equity:Opening-Balances      -5,000 USD
            Equity:Conversions:Previous  -6,000 CAD
            Equity:Opening-Balances       6,000 CAD

            ;; 2012-06-01  BEGIN --------------------------------

            2012-08-01 * "Some income and expense to show"
            Income:Salary                11,000 USD
            Expenses:Taxes                3,200 USD
            Assets:US:Checking          -14,200 USD

            2012-08-02 * "Some other conversion to be summarized"
            Assets:US:Checking           -3,000 USD @ 1.25 CAD ;  -3,750 CAD
            Assets:CA:Checking            3,750 CAD            ;   3,750 CAD

            ;; 2012-09-01  END   --------------------------------

            2012-08-31 C "Conversion for (-3000 USD, 3750 CAD)"
            Equity:Conversions:Current    3,000 USD @ 0 NOTHING
            Equity:Conversions:Current   -3,750 CAD @ 0 NOTHING

            2012-12-31 T "Transfer balance for 'Income:Salary' (Transfer balance)"
            Income:Salary               -11,000 USD
            Equity:Earnings:Current      11,000 USD

            2012-12-31 T "Transfer balance for 'Expenses:Taxes' (Transfer balance)"
            Expenses:Taxes               -3,200 USD
            Equity:Earnings:Current       3,200 USD    
        `);
  });
});

describe("summarize", () => {
  test("retains the last historical price from the original ledger", () => {
    const firstDate = DateTime.fromISO("2024-01-01");
    const secondDate = DateTime.fromISO("2024-02-01");
    const cutoff = DateTime.fromISO("2024-03-01");
    const [entries, index] = summarize(
      [
        new Price(firstDate, "HOOL", new Amount("10", "USD")),
        new Price(secondDate, "HOOL", new Amount("12", "USD")),
      ],
      cutoff,
      "Equity:Opening-Balances",
    );

    expect(index).toBe(1);
    expect(entries).toEqual([
      new Price(secondDate, "HOOL", new Amount("12", "USD")),
    ]);
  });
});
