import { describe, expect, test } from "vitest";
import {
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
