import { describe, expect, test } from "vitest";
import {
  accountOpenClose,
  accountLeaf,
  accountParents,
  accountRoot,
  commonAccountPrefix,
  hasAccountComponent,
  isDescendantOf,
  isValidAccount,
  isValidLeaf,
  isValidRoot,
  joinAccount,
  matchesAccount,
  parent,
  parentMatcher,
  sansRoot,
  splitAccount,
} from "./account";
import { AccountTypes, defaultBeancountOptions } from "./options";
import { DateTime } from "luxon";
import { Amount } from "./amount";
import { Close, Open, Posting, Transaction } from "./data";

describe("account names", () => {
  test("validates roots, leaves, and full hierarchical names", () => {
    expect(isValidRoot("Assets")).toBe(true);
    expect(isValidRoot("assets")).toBe(false);
    expect(isValidLeaf("Brokerage-2")).toBe(true);
    expect(isValidLeaf("2FA")).toBe(true);
    expect(isValidLeaf("checking")).toBe(false);
    expect(isValidAccount("Assets:Brokerage-2:2FA")).toBe(true);
    expect(isValidAccount("Assets")).toBe(false);
    expect(isValidAccount("Assets::Cash")).toBe(false);
    expect(matchesAccount("Expenses:Dining")).toBe(true);
    expect(matchesAccount("Expenses:Dining ")).toBe(true);
  });

  test("provides account hierarchy helpers", () => {
    const account = "Assets:Cash:Wallet";

    expect(joinAccount("Assets", "Cash", "Wallet")).toBe(account);
    expect(splitAccount(account)).toEqual(["Assets", "Cash", "Wallet"]);
    expect(accountRoot(account)).toBe("Assets");
    expect(accountLeaf(account)).toBe("Wallet");
    expect(sansRoot(account)).toBe("Cash:Wallet");
    expect(parent(account)).toBe("Assets:Cash");
    expect(hasAccountComponent(account, "Cash")).toBe(true);
    expect([...accountParents(account)]).toEqual([
      "Assets:Cash:Wallet",
      "Assets:Cash",
      "Assets",
    ]);
    expect(
      commonAccountPrefix([
        "Assets:Cash:Wallet",
        "Assets:Cash:Bank",
        "Assets:Investments",
      ]),
    ).toBe("Assets");
    expect(isDescendantOf("Assets:Cash", account)).toBe(true);
    expect(parentMatcher("Assets:Cash")(account)).toBe(true);
  });
});

describe("account type classification", () => {
  test("uses the configured roots for classification and balance signs", () => {
    const types = new AccountTypes(
      defaultBeancountOptions({
        name_assets: "Actifs",
        name_liabilities: "Passifs",
        name_equity: "Capitaux",
        name_income: "Revenus",
        name_expenses: "Dépenses",
      }),
    );

    expect(types.getAccountType("Actifs:Cash")).toBe("Actifs");
    expect(types.isAccountType("Actifs:Cash", "Actifs")).toBe(true);
    expect(types.isRootAccount("Actifs:Cash", "Actifs")).toBe(true);
    expect(types.isBalanceSheetAccount("Passifs:Card")).toBe(true);
    expect(types.isIncomeStatementAccount("Dépenses:Food")).toBe(true);
    expect(types.isEquityAccount("Capitaux:Opening")).toBe(true);
    expect(types.isInvertedAccount("Passifs:Card")).toBe(true);
    expect(types.getAccountSign("Revenus:Salary")).toBe(-1);
    expect(types.getAccountSign("Dépenses:Food")).toBe(1);
  });
});

describe("account lifecycle", () => {
  test("retains the earliest open and close while tracking later activity", () => {
    const account = "Assets:Cash";
    const jan = DateTime.fromISO("2024-01-01");
    const feb = DateTime.fromISO("2024-02-01");
    const mar = DateTime.fromISO("2024-03-01");
    const apr = DateTime.fromISO("2024-04-01");
    const firstOpen = new Open(jan, account);
    const firstClose = new Close(mar, account);
    const entries = [
      firstOpen,
      new Transaction(
        feb,
        "*",
        "",
        "Activity",
        [],
        [],
        [new Posting(account, new Amount("1", "USD"))],
      ),
      firstClose,
      new Open(feb, account),
      new Close(apr, account),
      new Transaction(
        apr,
        "*",
        "",
        "Later activity",
        [],
        [],
        [new Posting(account, new Amount("-1", "USD"))],
      ),
    ];

    const lifecycle = accountOpenClose(entries)[account];
    expect(lifecycle.open).toBe(firstOpen);
    expect(lifecycle.close).toBe(firstClose);
    expect(lifecycle.updatedAt).toEqual(apr);
  });
});
