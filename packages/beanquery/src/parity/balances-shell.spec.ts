import { describe, expect, test } from "vitest";
import { expandShellQuery } from "../shell";
import balancesFixture from "./fixtures/balances-shell.json";

describe("balances shell parity", () => {
  test("expands balances to a SELECT GROUP BY account query", () => {
    expect(expandShellQuery("balances")).toBe(
      "SELECT account, sum((position)) GROUP BY account",
    );
    expect(expandShellQuery("BALANCES FROM year = 2014")).toBe(
      "SELECT account, sum((position)) FROM year = 2014 GROUP BY account",
    );
    expect(expandShellQuery("balance")).toBe(
      "SELECT account, sum((position)) GROUP BY account",
    );
  });

  test("fixture documents Fava balances oracle shape", () => {
    expect(balancesFixture.scenario.query).toBe("balances");
    expect(balancesFixture.oracle.sampleRows[0][0]).toMatch(/^Assets:/);
  });
});
