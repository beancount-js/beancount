import { describe, expect, test } from "vitest";
import { UPSTREAM_COMMIT } from "./manifest";
import balancesFixture from "./fixtures/balances-shell.json";

describe("beanquery parity fixtures", () => {
  test("balances-shell pins the Fava commit and captures oracle shape", () => {
    expect(balancesFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    expect(balancesFixture.scenario.query).toBe("balances");
    expect(balancesFixture.oracle.t).toBe("table");
    expect(balancesFixture.oracle.rowCount).toBeGreaterThan(0);
    expect(balancesFixture.oracle.sampleRows[0][0]).toMatch(/^Assets:/);
  });
});
