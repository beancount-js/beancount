import { loadString } from "@beancount-js/beancount";
import { describe, expect, test } from "vitest";
import { groupOtherLedgerAccounts } from "./other-accounts";

describe("groupOtherLedgerAccounts", () => {
  test("groups open accounts while excluding standalone and grouped sync accounts", () => {
    const [directives] = loadString(`
      2026-01-01 open Assets:Bank:Current GBP
      2026-01-01 open Assets:Cash:Wallet GBP
      2026-01-01 open Liabilities:Card:Main GBP
      2026-01-01 open Expenses:Food GBP
      2026-01-01 open Expenses:Travel GBP
      2026-01-01 open Income:Salary GBP
    `);

    const groups = groupOtherLedgerAccounts(directives, [
      { sourceAccount: "Assets:Bank:Current" },
      {
        accounts: [{ sourceAccount: "Liabilities:Card:Main" }],
      },
    ]);

    expect(
      groups.map((group) => [
        group.label,
        group.accounts.map((account) => account.name),
      ]),
    ).toEqual([
      ["Assets", ["Assets:Cash:Wallet"]],
      ["Income", ["Income:Salary"]],
      ["Expenses", ["Expenses:Food", "Expenses:Travel"]],
    ]);
  });

  test("keeps the open directive available for the inline editor", () => {
    const [directives] = loadString(`
      2026-01-01 open Equity:Opening-Balances
    `);

    const [group] = groupOtherLedgerAccounts(directives, []);

    expect(group?.accounts[0]?.open.account).toBe("Equity:Opening-Balances");
    expect(group?.accounts[0]?.open.lineno).toBeGreaterThan(0);
  });
});
