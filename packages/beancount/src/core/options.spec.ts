import { describe, expect, test } from "vitest";
import { Decimal } from "@beancount-js/parser";
import { loadString } from "../parser/loader";
import {
  AccountTypes,
  beanCountOptionsSchema,
  bool,
  canonicalOptionKey,
  defaultBeancountOptions,
} from "./options";

describe("Beancount options", () => {
  test("uses the pinned runtime defaults", () => {
    const options = defaultBeancountOptions();

    expect(options).toMatchObject({
      account_rounding: null,
      account_unrealized_gains: "Earnings:Unrealized",
      display_precision: {},
      insert_pythonpath: false,
      render_commas: false,
      title: "Beancount",
      tolerance_multiplier: new Decimal("0.5"),
      use_precise_interpolation: false,
    });
    expect(beanCountOptionsSchema.parse(options)).toEqual(options);
  });

  test("normalizes deprecated tolerance multiplier input", () => {
    const [, errors, options] = loadString(
      'option "inferred_tolerance_multiplier" "0.75"',
      { transform: false },
    );

    expect(errors).toEqual([]);
    expect(options.tolerance_multiplier).toEqual(new Decimal("0.75"));
    expect(options).not.toHaveProperty("inferred_tolerance_multiplier");
    expect(canonicalOptionKey("inferred-tolerance-multiplier")).toBe(
      "tolerance_multiplier",
    );
  });

  test("accepts upstream boolean spellings", () => {
    const [, errors, options] = loadString(
      [
        'option "insert_pythonpath" "yes"',
        'option "render_commas" "FALSE"',
      ].join("\n"),
      { transform: false },
    );

    expect(errors).toEqual([]);
    expect(options.insert_pythonpath).toBe(true);
    expect(options.render_commas).toBe(false);
  });

  test("preserves repeated list options and reports canonical alias locations", () => {
    const [, repeatedErrors, repeatedOptions] = loadString(
      [
        'option "operating_currency" "USD"',
        'option "operating_currency" "EUR"',
      ].join("\n"),
      { transform: false },
    );
    const [, aliasErrors] = loadString(
      'option "inferred_tolerance_multiplier" "-1"',
      { transform: false },
    );

    expect(repeatedErrors).toEqual([]);
    expect(repeatedOptions.operating_currency).toEqual(["USD", "EUR"]);
    expect(aliasErrors[0].message).toContain("tolerance_multiplier");
    expect(aliasErrors[0].context.lineno).toBe(1);
  });

  test("validates booleans and classifies accounts with configured roots", () => {
    expect(bool.safeParse(2).success).toBe(false);
    const types = new AccountTypes(
      defaultBeancountOptions({ name_assets: "Resources" }),
    );

    expect(types.isBalanceSheetAccount("Resources:Cash")).toBe(true);
    expect(types.isIncomeStatementAccount("Expenses:Food")).toBe(true);
    expect(types.getAccountSign("Income:Salary")).toBe(-1);
    expect(types.getAccountSign("Resources:Cash")).toBe(1);
    expect(types.sortKey("Unknown:Account")).toEqual([5, "Unknown:Account"]);
    expect(types.previousAccounts()).toEqual([
      "Equity:Earnings:Previous",
      "Equity:Opening-Balances",
      "Equity:Conversions:Previous",
    ]);
  });
});
