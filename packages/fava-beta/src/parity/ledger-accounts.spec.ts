import { describe, expect, test } from "vitest";
import { LedgerSource } from "../core/ledger";
import ledgerAccountsFixture from "./fixtures/ledger-accounts.json";

describe("ledger_data.accounts parity", () => {
  test("omits intermediate-only parent accounts from the account list", () => {
    const source = new LedgerSource(`
      2014-01-01 open Assets:US:BofA:Checking USD
      2014-01-01 open Assets:US:ETrade:GLD GLD
      2014-01-01 open Expenses:Food:Restaurant USD
      2014-01-01 open Equity:Opening-Balances USD

      2014-01-02 * "Seed"
        Assets:US:BofA:Checking         100.00 USD
        Equity:Opening-Balances
    `);

    const accounts = source.data.accounts;
    for (const account of ledgerAccountsFixture.oracle.mustInclude) {
      expect(accounts).toContain(account);
    }
    for (const account of ledgerAccountsFixture.oracle.mustExclude) {
      expect(accounts).not.toContain(account);
    }

    // Tree rollup still materialises parents for UI aggregation.
    expect(source.data.tree.accounts).toContain("Assets");
    expect(source.data.tree.accounts).toContain("Assets:US");
  });
});
