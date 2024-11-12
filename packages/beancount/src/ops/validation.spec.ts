import { describe, test, expect } from "vitest";

import {
  validateActiveAccounts,
  validateDuplicateBalances,
  validateDuplicateCommodities,
  validateOpenClose,
} from "./validation";
import { parseDirectives } from "../parser/parser";

describe("Validate Open/Close", () => {
  test("duplicate open", () => {
    const [directives, errors] = parseDirectives(`
        ;; Regular, only appears once.
        2014-02-10 open  Assets:US:Bank:Checking1

        ;; Open twice on the same date.
        2014-02-11 open  Assets:US:Bank:Checking2
        2014-02-11 open  Assets:US:Bank:Checking2

        ;; Open twice on different dates.
        2014-02-20 open  Assets:US:Bank:Checking3
        2014-02-21 open  Assets:US:Bank:Checking3
      `);

    const validationErrors = validateOpenClose(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Duplicate open directive for Assets:US:Bank:Checking2",
      "Duplicate open directive for Assets:US:Bank:Checking3",
    ]);
  });

  test("duplicate close", () => {
    const [directives, errors] = parseDirectives(`
        2014-02-10 open  Assets:US:Bank:Checking1
        2014-02-10 open  Assets:US:Bank:Checking2
        2014-02-10 open  Assets:US:Bank:Checking3

        ;; Regular, only appears once.
        2014-03-01 close Assets:US:Bank:Checking1

        ;; Close twice on the same date.
        2014-03-11 close Assets:US:Bank:Checking2
        2014-03-11 close Assets:US:Bank:Checking2

        ;; Close twice on different dates.
        2014-03-21 close Assets:US:Bank:Checking3
        2014-03-22 close Assets:US:Bank:Checking3
      `);

    const validationErrors = validateOpenClose(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Duplicate close directive for Assets:US:Bank:Checking2",
      "Duplicate close directive for Assets:US:Bank:Checking3",
    ]);
  });

  test("close unopend", () => {
    const [directives] = parseDirectives(`
         2014-03-01 close Assets:US:Bank:Checking1
      `);

    const validationErrors = validateOpenClose(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Unopened account Assets:US:Bank:Checking1 is being closed",
    ]);
  });

  test("close ordering", () => {
    const [directives] = parseDirectives(`
        2014-03-01 open  Assets:US:Bank:Checking1
        2014-02-01 close Assets:US:Bank:Checking1
      `);
    const validationErrors = validateOpenClose(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Unopened account Assets:US:Bank:Checking1 is being closed",
    ]);
  });
});

describe("Validate", () => {
  test("duplicate balances", () => {
    const [directives] = parseDirectives(`
        2014-01-01 open Assets:US:Bank:Checking1
        2014-01-01 open Assets:US:Bank:Checking2

        ;; Duplicates, with different amounts (error).
        2014-03-01 balance Assets:US:Bank:Checking1  100 USD
        2014-03-01 balance Assets:US:Bank:Checking1  101 USD

        ;; Duplicates, with same amount (okay).
        2014-03-02 balance Assets:US:Bank:Checking1  100 USD
        2014-03-02 balance Assets:US:Bank:Checking1  100 USD

        ;; Different dates (okay).
        2014-03-03 balance Assets:US:Bank:Checking1  100 USD
        2014-03-04 balance Assets:US:Bank:Checking1  101 USD

        ;; Different currencies (okay).
        2014-03-03 balance Assets:US:Bank:Checking1  100 USD
        2014-03-04 balance Assets:US:Bank:Checking1  100 CAD

        ;; Different accounts at same date (okay).
        2014-03-05 balance Assets:US:Bank:Checking1  100 USD
        2014-03-05 balance Assets:US:Bank:Checking2  100 USD
        `);

    const validationErrors = validateDuplicateBalances(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Duplicate balance assertion with different amounts",
    ]);
  });

  test("duplicate commodities", () => {
    const [directives, errors] = parseDirectives(`
            2014-01-01 commodity USD
            2014-01-02 commodity CAD
            2014-01-03 commodity AAPL
            2014-01-04 commodity HOOL
            2014-01-05 commodity USD
            2014-01-06 commodity HOOL
          `);

    const validationErrors = validateDuplicateCommodities(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Duplicate commodity directives for 'USD'",
      "Duplicate commodity directives for 'HOOL'",
    ]);
  });

  test("active accounts", () => {
    const [directives, errors] = parseDirectives(`
        2014-01-01 open  Equity:Opening-Balances

        2014-02-01 * "Invalid before"
          Assets:Temporary          1 USD
          Equity:Opening-Balances  -1 USD

        2014-02-02 note  Assets:Temporary "Invalid note entry"
        2014-02-03 pad   Assets:Temporary Equity:Opening-Balances

        2014-03-01 open  Assets:Temporary

        2014-04-01 * "Valid"
          Assets:Temporary           1 USD
          Equity:Opening-Balances   -1 USD

        2014-05-01 * "Unknown account"
          Assets:Temporary    1 USD
          Equity:ImUnknown   -1 USD

        2014-09-01 close Assets:Temporary

        2014-10-01 * "Invalid after"
          Assets:Temporary           1 USD
          Equity:Opening-Balances   -1 USD

        ;; These should be allowed after close.
        2014-10-02 note  Assets:Temporary "Invalid note entry again"
        2014-10-03 document  Assets:Temporary "/path/to/allowed-doc.pdf"
          `);

    const expected = [
      "Invalid reference to inactive account 'Assets:Temporary'",
      "Invalid reference to inactive account 'Assets:Temporary'",
      "Invalid reference to inactive account 'Assets:Temporary'",
      "Invalid reference to unknown account 'Equity:ImUnknown'",
      "Invalid reference to inactive account 'Assets:Temporary'",
    ];
    const validationErrors = validateActiveAccounts(directives);
    expect(validationErrors.map((it) => it.message)).toEqual(expected);
  });

  test("active accounts unopend", () => {
    const [directives, errors] = parseDirectives(`
          2014-02-01 *
            Assets:US:Bank:Checking     100 USD
            Assets:US:Bank:Savings     -100 USD
          `);

    const validationErrors = validateActiveAccounts(directives);
    expect(validationErrors.map((it) => it.message)).toEqual([
      "Invalid reference to unknown account 'Assets:US:Bank:Checking'",
      "Invalid reference to unknown account 'Assets:US:Bank:Savings'",
    ]);
  });
});
