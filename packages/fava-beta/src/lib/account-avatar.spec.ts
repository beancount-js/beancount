import { describe, expect, it } from "vitest";
import {
  accountAvatarFallbackColor,
  accountAvatarInitial,
} from "../../../forms/src/account-avatar";

describe("account avatar fallback appearance", () => {
  it("uses the first letter of the final account segment", () => {
    expect(accountAvatarInitial("Assets:Investments:ISA:Cash")).toBe("C");
    expect(accountAvatarInitial("Liabilities:CreditCard:Natwest")).toBe("N");
  });

  it("assigns the same deterministic fallback colour to matching initials", () => {
    expect(accountAvatarFallbackColor("Assets:Cash")).toBe(
      accountAvatarFallbackColor("Income:Cash"),
    );
    expect(accountAvatarFallbackColor("Assets:Cash")).not.toBe(
      accountAvatarFallbackColor("Assets:Holiday"),
    );
  });
});
