import { describe, test, expect } from "vitest";
import { Balance } from "../core/data";
import { balanceTolerance, checkBalance } from "./balance";
import { Amount, defaultBeancountOptions } from "../core";
import { parseDirectives } from "../parser/parser";
import { Decimal } from "@beancount-js/parser";

const OPTIONS = defaultBeancountOptions();

describe("Balance", () => {
  test("simple error", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:US:Checking
        2013-05-03 balance Assets:US:Checking   100 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([
      "Balance failed for 'Assets:US:Checking':\nexpected 100 USD != accumulated 0 USD (100 USD too little)",
    ]);

    expect(
      updated.filter((it) => it instanceof Balance).map((it) => it.diff),
    ).toEqual([new Amount("-100", "USD")]);
  });

  test("invalid currency", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking      CAD
        2013-05-01 open Equity:Opening-Balances

        ;; This ought to fail because USD isn't a valid currency.
        2013-05-03 balance Assets:Bank:Checking   0.00 USD
    `);

    const [_updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([
      "Invalid currency 'USD' for Balance directive",
    ]);
  });

  test("simple first", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking                100 USD
          Equity:Opening-Balances

        2013-05-03 balance Assets:Bank:Checking   100 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("balance does not exist", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Invest
        2013-05-01 open Equity:Opening-Balances

        2013-05-10 balance Assets:Invest:Invalid   0 HOOL
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([
      "Invalid reference to unknown account 'Assets:Invest:Invalid'",
    ]);
    // balance check shouldn't "eat" the balance entry.
    expect(updated.length).toEqual(3);
    expect(updated[2]).instanceOf(Balance);
  });

  test("check same date", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:US:Checking   USD
        2013-05-01 open Expenses:Something

        2013-05-02 txn "Testing!"
          Assets:US:Checking            100 USD
          Expenses:Something           -100 USD

        2013-05-02 balance Assets:US:Checking     0 USD
        2013-05-03 balance Assets:US:Checking   100 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("balance before create", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:US:Checking   USD
        2013-05-01 open Expenses:Something

        2013-05-01 balance Assets:US:Checking     0 USD

        2013-05-03 txn "Testing!"
          Assets:US:Checking            100 USD
          Expenses:Something           -100 USD
    `);
    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("balance with prefix account", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Assets:Bank:CheckingOld
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking                100 USD
          Equity:Opening-Balances

        2013-05-03 *
          Assets:Bank:CheckingOld              27 USD
          Equity:Opening-Balances

        2013-05-10 balance Assets:Bank:Checking   100 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("mixed cost and no cost", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Invest
        2013-05-01 open Equity:Opening-Balances

        2013-05-01 *
          Assets:Invest                100 HOOL {14.33 USD}
          Equity:Opening-Balances

        2013-05-02 *
          Assets:Invest               -100 HOOL @ 15.66 USD
          Equity:Opening-Balances

        2013-05-10 balance Assets:Invest   0 HOOL
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("precision", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Income:Interest

        2013-05-02 *
          Assets:Bank:Checking        0.00001 USD
          Income:Interest

        2013-05-03 balance Assets:Bank:Checking   0.00 USD

        2013-05-03 *
          Assets:Bank:Checking        0.00001 USD
          Income:Interest

        2013-05-04 balance Assets:Bank:Checking   0.00 USD

        2013-05-04 *
          Assets:Bank:Checking        0.015 USD
          Income:Interest

        2013-05-05 balance Assets:Bank:Checking   0.01502 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("parents", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank
        2013-05-01 open Assets:Bank:Checking1
        2013-05-01 open Assets:Bank:Checking2
        2013-05-01 open Assets:Bank:Savings   ;; Will go negative
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking1                100 USD
          Equity:Opening-Balances

        2013-05-03 *
          Assets:Bank:Checking2                10 USD
          Equity:Opening-Balances

        2013-05-04 *
          Assets:Bank:Savings                 -50 USD
          Equity:Opening-Balances

        2013-05-05 balance Assets:Bank:Checking1  100 USD
        2013-05-05 balance Assets:Bank:Checking2   10 USD
        2013-05-05 balance Assets:Bank:Savings    -50 USD
        2013-05-05 balance Assets:Bank             60 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("parents only", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank
        2013-05-01 open Assets:Bank:Checking1
        2013-05-01 open Assets:Bank:Checking2
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking1                100 USD
          Equity:Opening-Balances

        2013-05-03 *
          Assets:Bank:Checking2                10 USD
          Equity:Opening-Balances

        2013-05-05 balance Assets:Bank         110 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("parents with postings", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank
        2013-05-01 open Assets:Bank:Checking1
        2013-05-01 open Assets:Bank:Checking2
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking1                100 USD
          Equity:Opening-Balances

        2013-05-03 *
          Assets:Bank:Checking2                10 USD
          Equity:Opening-Balances

        2013-05-04 * "Posting on a parent account"
          Assets:Bank                          15 USD
          Equity:Opening-Balances

        2013-05-05 balance Assets:Bank        125 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("with lots", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Investing
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Investing                1 HOOL {501 USD}
          Equity:Opening-Balances

        2013-05-03 balance Assets:Bank:Investing    1 HOOL
    `);
    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("simple cont", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking                100 USD
          Equity:Opening-Balances

        2013-05-03 balance Assets:Bank:Checking   100 USD

        2013-05-04 *
          Assets:Bank:Checking                 10 USD
          Equity:Opening-Balances

        2013-05-05 balance Assets:Bank:Checking   110 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("simple partial currency first", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking                100 USD
          Assets:Bank:Checking                200 CAD
          Equity:Opening-Balances

        2013-05-03 balance Assets:Bank:Checking   100 USD
        2013-05-03 balance Assets:Bank:Checking   200 CAD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });

  test("simple partial currency cont", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-02 *
          Assets:Bank:Checking                100 USD
          Assets:Bank:Checking                200 CAD
          Equity:Opening-Balances

        2013-05-03 balance Assets:Bank:Checking   100 USD

        2013-05-04 *
          Assets:Bank:Checking                 10 USD
          Assets:Bank:Checking                 20 CAD
          Equity:Opening-Balances

        2013-05-05 balance Assets:Bank:Checking   110 USD
        2013-05-05 balance Assets:Bank:Checking   220 CAD
    `);
    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([]);
  });
});

describe("Balance Precision", () => {
  test("get tolerance", () => {
    const [directives] = parseDirectives(`
        2015-05-01 open Assets:Bank:Checking
        2015-05-02 balance Assets:Bank:Checking   0    ~ 0.002 USD
        2015-05-02 balance Assets:Bank:Checking   0.0  ~ 0.002 USD
        2015-05-02 balance Assets:Bank:Checking   0.00 ~ 0.002 USD
        2015-05-02 balance Assets:Bank:Checking   1    ~ 0.002 USD
        2015-05-02 balance Assets:Bank:Checking   1.0  ~ 0.002 USD
        2015-05-02 balance Assets:Bank:Checking   1.00 ~ 0.002 USD
    `);

    const tolerances = directives
      .filter((it) => it instanceof Balance)
      .map((it) => it.tolerance);

    expect(tolerances).toEqual(Array(6).fill("0.002"));
  });

  test("balance tolerance", () => {
    const [directives] = parseDirectives(`
        2015-05-01 open Assets:Bank:Checking
        2015-05-02 balance Assets:Bank:Checking   0 USD
        2015-05-02 balance Assets:Bank:Checking   0.0 USD
        2015-05-02 balance Assets:Bank:Checking   0.00 USD
        2015-05-02 balance Assets:Bank:Checking   0.000 USD
        2015-05-02 balance Assets:Bank:Checking   1 USD
        2015-05-02 balance Assets:Bank:Checking   1.0 USD
        2015-05-02 balance Assets:Bank:Checking   1.00 USD
        2015-05-02 balance Assets:Bank:Checking   1.000 USD
        2015-05-02 balance Assets:Bank:Checking   1.01 USD
    `);

    const tolerances = directives
      .filter((it) => it instanceof Balance)
      .map((it) => balanceTolerance(it, OPTIONS));
    expect(tolerances).toEqual(
      [0, 0.1, 0.01, 0.001, 0, 0.1, 0.01, 0.001, 0.01].map(
        (it) => new Decimal(it),
      ),
    );
  });

  test("balance with tolerance", () => {
    const [directives] = parseDirectives(`
        2013-05-01 open Assets:Bank:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-03 *
          Assets:Bank:Checking              23.024 USD
          Equity:Opening-Balances

        2015-05-02 balance Assets:Bank:Checking   23.022 ~ 0.001 USD
        2015-05-03 balance Assets:Bank:Checking   23.023 ~ 0.001 USD
        2015-05-04 balance Assets:Bank:Checking   23.024 ~ 0.001 USD
        2015-05-05 balance Assets:Bank:Checking   23.025 ~ 0.001 USD
        2015-05-06 balance Assets:Bank:Checking   23.026 ~ 0.001 USD

        2015-05-10 balance Assets:Bank:Checking   23.03 ~ 0.01 USD
    `);

    const [updated, balanceErrors] = checkBalance(directives, OPTIONS);
    expect(balanceErrors.map((it) => it.message)).toEqual([
      "Balance failed for 'Assets:Bank:Checking':\nexpected 23.022 USD != accumulated 23.024 USD (0.002 USD too much)",
      "Balance failed for 'Assets:Bank:Checking':\nexpected 23.026 USD != accumulated 23.024 USD (0.002 USD too little)",
    ]);

    expect(
      updated
        .filter((it) => it instanceof Balance)
        .filter((it) => it.diff)
        .map((it) => it.diff),
    ).toEqual([new Amount("0.002", "USD"), new Amount("-0.002", "USD")]);
  });
});
