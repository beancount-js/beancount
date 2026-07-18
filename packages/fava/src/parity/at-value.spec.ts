import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { Conversion, loadString, PriceMap } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { LedgerSource } from "../core/ledger";
import { Tree } from "../core/tree";
import accountReportFixture from "./fixtures/account-report-off-by-one.json";
import marketValueFixture from "./fixtures/market-value.json";
import offByOneLedger from "./fixtures/off-by-one.beancount?raw";

function normalizeInventory(inv: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(inv)) {
    if (Math.abs(amount) < 1e-9) continue;
    out[currency] = Math.round(amount * 1e4) / 1e4;
  }
  return out;
}

describe("AT_VALUE conversion parity", () => {
  test("market-value cases match Fava get_market_value tables", () => {
    const [directives] = loadString(
      `
1980-01-01 open Assets:Broker
1980-01-01 open Assets:Cash
${marketValueFixture.pricesLedger}
2022-02-01 * "seed"
  Assets:Broker    10 STOCK {5 USD}
  Assets:Cash
`,
      { transform: true },
    );
    const prices = new PriceMap(directives);
    const tree = new Tree({ entries: directives });
    const node = tree.get("Assets:Broker");

    for (const testCase of marketValueFixture.cases) {
      if (!testCase.position.includes("{")) {
        // Uncosted lots stay in units — covered by units conversion.
        continue;
      }
      const asOf = testCase.date
        ? DateTime.fromISO(testCase.date, { zone: "utc" })
        : undefined;
      const actual = normalizeInventory(
        node.balance.toRecord(Conversion.AT_VALUE, {
          prices,
          date: asOf,
        }),
      );
      expect(actual, JSON.stringify(testCase)).toEqual(testCase.expected);
    }
  });

  test("off-by-one account_report at_value balances match Fava oracle", () => {
    const source = new LedgerSource(offByOneLedger, { logTimings: undefined });
    const trees = source.data.balanceTrees("day");
    const byBegin = new Map(
      trees.map((tree) => [
        tree.range.from.toISODate(),
        tree.tree.get("Assets").toRecord(Conversion.AT_VALUE, {
          prices: source.prices,
          date: tree.range.endInclusive,
        }),
      ]),
    );

    for (const [index, date] of accountReportFixture.oracle.dates.entries()) {
      const actual = byBegin.get(date.begin);
      expect(actual, date.begin).toBeTruthy();
      const expected =
        accountReportFixture.oracle.interval_balances[index];
      expect(normalizeInventory(actual!.balanceChildren)).toEqual(
        normalizeInventory(expected.balance_children),
      );
    }
  });
});
