import { describe, expect, test } from "vitest";
import { monzoAccountDisplayName } from "./account-label";
import type { MonzoAccount } from "./types";

describe("monzoAccountDisplayName", () => {
  test.each<{
    name: string;
    account: MonzoAccount;
    expected: string;
  }>([
    {
      name: "personal account with top-level UK payment details",
      account: {
        id: "personal",
        accountType: "uk_retail",
        sortCode: "040004",
        accountNumber: "42979962",
      },
      expected: "Personal · 04-00-04 · 42979962",
    },
    {
      name: "joint account with nested UK payment details",
      account: {
        id: "joint",
        accountType: "uk_retail_joint",
        paymentDetails: { sortCode: "040004", accountNumber: "32683320" },
      },
      expected: "Joint · 04-00-04 · 32683320",
    },
    {
      name: "Flex account",
      account: {
        id: "flex",
        accountType: "uk_monzo_flex",
        isFlex: true,
        productType: "flex",
      },
      expected: "Flex",
    },
    {
      name: "prepaid account",
      account: { id: "prepaid", accountType: "uk_prepaid" },
      expected: "Prepaid",
    },
    {
      name: "loan account",
      account: { id: "loan", accountType: "uk_loan", productType: "loan" },
      expected: "Loan",
    },
    {
      name: "unknown provider type",
      account: { id: "unknown", accountType: "uk_savings_account" },
      expected: "Savings Account",
    },
    {
      name: "unknown account without a type",
      account: { id: "unknown" },
      expected: "Monzo Account",
    },
    {
      name: "malformed payment details",
      account: {
        id: "malformed",
        accountType: "uk_retail",
        sortCode: "04-00-04",
        accountNumber: "not-an-account-number",
      },
      expected: "Personal",
    },
  ])("uses $name", ({ account, expected }) => {
    expect(monzoAccountDisplayName(account)).toBe(expected);
  });

  test("never uses Monzo's raw description", () => {
    expect(
      monzoAccountDisplayName({
        id: "account",
        accountType: "uk_retail",
      }),
    ).toBe("Personal");
  });
});
