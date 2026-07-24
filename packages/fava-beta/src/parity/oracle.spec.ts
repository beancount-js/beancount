import { describe, expect, test } from "vitest";
import { UPSTREAM_COMMIT } from "./manifest";
import accountReportFixture from "./fixtures/account-report-off-by-one.json";
import intervalEndsFixture from "./fixtures/interval-ends.json";
import marketValueFixture from "./fixtures/market-value.json";
import offByOneLedger from "./fixtures/off-by-one.beancount?raw";

describe("fava report parity fixtures", () => {
  test("account-report-off-by-one pins the Fava commit and off-by-one oracle", () => {
    expect(accountReportFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(accountReportFixture.scenario.account).toBe("Assets");
    expect(accountReportFixture.scenario.conversion).toBe("at_value");
    expect(accountReportFixture.oracle.dates).toHaveLength(4);
    expect(
      accountReportFixture.oracle.interval_balances[0].balance_children,
    ).toEqual({ USD: 104 });
  });

  test("interval-ends borrows Fava util.date cases", () => {
    expect(intervalEndsFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(intervalEndsFixture.cases).toHaveLength(4);
    expect(intervalEndsFixture.cases[0].expectComplete).toEqual([
      "2014-03-01",
      "2014-04-01",
      "2014-05-01",
      "2014-06-01",
    ]);
  });

  test("market-value borrows Fava conversion cases", () => {
    expect(marketValueFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(marketValueFixture.cases.length).toBeGreaterThan(0);
    expect(marketValueFixture.cases.at(-1)?.expected).toEqual({ USD: 200 });
  });

  test("off-by-one ledger fixture is present", () => {
    expect(offByOneLedger).toContain('option "title" "off-by-one"');
    expect(offByOneLedger).toContain("price COM");
  });
});
