import { describe, expect, it } from "vitest";
import {
  accountAvatarFallbackColor,
  accountAvatarImageDataUrl,
  accountAvatarInitial,
} from "./account-avatar";

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

  it("provides the same fallback identity to image-based pickers", () => {
    const image = decodeURIComponent(
      accountAvatarImageDataUrl("Assets:Checking").replace(
        "data:image/svg+xml,",
        "",
      ),
    );
    expect(image).toContain(">C</text>");
    expect(image).toContain(accountAvatarFallbackColor("Assets:Checking"));
  });
});
