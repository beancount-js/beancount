import { describe, expect, it } from "vitest";
import {
  buildLedgerHref,
  hashUrlToLedgerHref,
  ledgerStemForPath,
  parseLedgerAndView,
  resolveLedgerPath,
  viewPathToSegments,
} from "./ledger-route";

const available = [
  "sample.beancount",
  "a/b/sample.beancount",
  "tax/2026/main.bean",
  "dup.bean",
  "dup.beancount",
];

describe("ledger-route", () => {
  it("parses view and ledger stem from catch-all segments", () => {
    expect(parseLedgerAndView(["sample", "journal"])).toEqual({
      ledgerStem: "sample",
      viewPath: "/journal",
      viewSegment: "journal",
      params: {},
    });
    expect(parseLedgerAndView(["a", "b", "sample", "trial-balance"])).toEqual({
      ledgerStem: "a/b/sample",
      viewPath: "/trial_balance",
      viewSegment: "trial-balance",
      params: {},
    });
    expect(
      parseLedgerAndView(["a", "b", "sample", "account", "Assets:Checking"]),
    ).toMatchObject({
      ledgerStem: "a/b/sample",
      viewPath: "/account/Assets:Checking",
      params: { account: "Assets:Checking" },
    });
    expect(parseLedgerAndView(["sample", "settings", "accounts"])).toEqual({
      ledgerStem: "sample",
      viewPath: "/import/accounts",
      viewSegment: "settings/accounts",
      params: {},
    });
  });

  it("defaults to journal when view is omitted", () => {
    expect(parseLedgerAndView(["sample"])).toMatchObject({
      ledgerStem: "sample",
      viewPath: "/journal",
    });
  });

  it("resolves extensionless stems and keeps ambiguous ones extensionful", () => {
    expect(resolveLedgerPath("sample", available)).toBe("sample.beancount");
    expect(resolveLedgerPath("a/b/sample", available)).toBe(
      "a/b/sample.beancount",
    );
    expect(resolveLedgerPath("dup", available)).toBeNull();
    expect(resolveLedgerPath("dup.bean", available)).toBe("dup.bean");
    expect(ledgerStemForPath("sample.beancount", available)).toBe("sample");
    expect(ledgerStemForPath("dup.bean", available)).toBe("dup.bean");
  });

  it("builds ledger pathnames with kebab view segments", () => {
    expect(viewPathToSegments("/income_statement")).toEqual([
      "income-statement",
    ]);
    expect(buildLedgerHref("bean-budget", "a/b/sample", "/dashboard")).toBe(
      "/bean-budget/ledger/a/b/sample/dashboard/",
    );
    expect(
      buildLedgerHref("bean-budget", "sample", "/account/Assets:Checking", {
        page: "2",
      }),
    ).toBe(
      "/bean-budget/ledger/sample/account/Assets%3AChecking/?page=2",
    );
  });

  it("maps legacy hash URLs to path hrefs", () => {
    expect(
      hashUrlToLedgerHref(
        "bean-budget",
        "#/journal?ledger=a/b/sample.beancount",
        available,
        "sample.beancount",
      ),
    ).toBe("/bean-budget/ledger/a/b/sample/journal/");
  });
});
