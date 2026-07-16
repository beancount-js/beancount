import { describe, test, expect } from "vitest";
import {
  AUTOMATIC_RESIDUAL,
  computeEntriesBalance,
  computeResidual,
  hasNonTrivialBalance,
  inferTolerances,
  quantizeWithTolerance,
} from "./interpolate";
import { Amount } from "./amount";
import { parseDirectives } from "../parser/parser";
import { Posting, Transaction } from "./data";
import { Decimal } from "@beancount-js/parser";
import { DateTime } from "luxon";
import { defaultBeancountOptions } from "./options";
import { Cost, CostSpec } from "./position";

const OPTIONS_MAP = defaultBeancountOptions({
  inferred_tolerance_default: {},
  tolerance_multiplier: new Decimal(0.5),
  account_rounding: null,
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

  test("accounts for costs and prices while ignoring incomplete and residual postings", () => {
    const tolerances = inferTolerances(
      [
        new Posting(
          "Assets:Investments",
          new Amount("1.00", "HOOL"),
          new Cost(null, new Amount("10", "USD")),
        ),
        new Posting(
          "Assets:Cash",
          new Amount("2.000", "EUR"),
          new CostSpec(new Decimal("10"), new Decimal("20"), "USD"),
        ),
        new Posting(
          "Assets:Skipped",
          new Amount(null, "HOOL"),
          null,
          new Amount("1.5", "USD"),
        ),
        new Posting(
          "Equity:Rounding",
          new Amount("1.00", "USD"),
          null,
          null,
          "",
          {
            [AUTOMATIC_RESIDUAL]: true,
          },
        ),
      ],
      defaultBeancountOptions({
        inferred_tolerance_default: {},
        tolerance_multiplier: new Decimal(0.5),
        infer_tolerance_from_cost: true,
      }),
    );

    expect(tolerances).toEqual({
      HOOL: new Decimal("0.005"),
      EUR: new Decimal("0.0005"),
      USD: new Decimal("0.055"),
    });
  });

  test("computes residuals and prefix balances without counting automatic residuals", () => {
    const jan = DateTime.fromISO("2024-01-01");
    const feb = DateTime.fromISO("2024-02-01");
    const first = new Transaction(
      jan,
      "*",
      "",
      "January",
      [],
      [],
      [
        new Posting("Assets:Cash", new Amount("5", "USD")),
        new Posting("Income:Salary", new Amount("-5", "USD")),
      ],
    );
    const second = new Transaction(
      feb,
      "*",
      "",
      "February",
      [],
      [],
      [
        new Posting("Assets:Cash", new Amount("3", "USD")),
        new Posting("Income:Salary", new Amount("-3", "USD")),
      ],
    );

    const residual = computeResidual([
      new Posting("Assets:Cash", new Amount("1", "USD")),
      new Posting("Equity:Rounding", new Amount("-1", "USD"), null, null, "", {
        [AUTOMATIC_RESIDUAL]: true,
      }),
    ]);

    expect(residual.toString()).toBe("(1 USD)");
    expect(
      computeEntriesBalance([first, second], "Assets", feb).toString(),
    ).toBe("(5 USD)");
  });

  test("distinguishes non-trivial balances and avoids overly precise quantization", () => {
    expect(
      hasNonTrivialBalance(
        new Posting(
          "Assets:Cash",
          new Amount("1", "EUR"),
          null,
          new Amount("1.1", "USD"),
        ),
      ),
    ).toBe(true);
    expect(
      hasNonTrivialBalance(new Posting("Assets:Cash", new Amount("1", "EUR"))),
    ).toBe(false);
    expect(
      quantizeWithTolerance(
        { USD: new Decimal("0.0123456") },
        new Amount("1.123456789", "USD"),
      ),
    ).toEqual(new Amount("1.123456789", "USD"));
  });
});
