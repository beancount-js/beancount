import { describe, test, expect } from "vitest";
import { inferTolerances, quantizeWithTolerance } from "./interpolate";
import { Amount } from "./amount";
import { parseDirectives } from "../parser/parser";
import type { Transaction } from "./data";
import { Decimal } from "@beancount-js/parser";
import { defaultBeancountOptions } from "./options";

const OPTIONS_MAP = defaultBeancountOptions({
  inferred_tolerance_default: {},
  inferred_tolerance_multiplier: new Decimal(0.5),
  account_rounding: undefined,
  infer_tolerance_from_cost: false,
});

describe("Interpolate", () => {
  test("infer tolerance", () => {
    const [directives] = parseDirectives(`
      2015-01-05 * "Investing 40% of cash in VBMPX"
        Assets:US:Vanguard:VBMPX          3.513 VBMPX {136.65 USD, 2015-01-05 }
        Assets:US:Vanguard:Cash         -480.05 USD
   `);
    expect(directives.length).toBe(1);
    const tolerances = inferTolerances(
      (directives[0] as Transaction).postings,
      OPTIONS_MAP,
    );
    expect(tolerances).toEqual({
      USD: new Decimal("0.005"),
      VBMPX: new Decimal("0.0005"),
    });
  });

  test("get tolerance", () => {
    const tolerances = {
      USD: new Decimal(0.01),
    };

    const cases: Array<{
      input: Amount;
      expected: Amount;
      tolerances?: Record<string, Decimal>;
      defaultTolerance?: Decimal;
    }> = [
      {
        input: new Amount("100.123123123", "USD"),
        expected: new Amount("100.12", "USD"),
      },
      {
        input: new Amount("100.123123123", "CAD"),
        expected: new Amount("100.12312", "CAD"),
      },
      {
        input: new Amount("100.123123123", "CAD"),
        expected: new Amount("100.123123123", "CAD"),
        defaultTolerance: Decimal.ZERO,
      },
    ];

    cases.forEach((testCase) => {
      expect(
        quantizeWithTolerance(
          testCase.tolerances || tolerances,
          testCase.input,
          testCase.defaultTolerance,
        ),
      ).toEqual(testCase.expected);
    });
  });
});
