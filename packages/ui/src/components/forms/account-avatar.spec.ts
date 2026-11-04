import { describe, expect, it } from "vitest";
import {
  accountAvatarFallbackColor,
  accountAvatarImageDataUrl,
  accountAvatarImageValue,
  accountAvatarInitial,
  accountAvatarRawEmoji,
  accountPickerOption,
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

  it("separates picker images and raw emoji from legacy icon names", () => {
    expect(accountAvatarImageValue("data:image/svg+xml,avatar")).toBe(
      "data:image/svg+xml,avatar",
    );
    expect(accountAvatarImageValue("https://example.test/avatar.png")).toBe(
      "https://example.test/avatar.png",
    );
    expect(accountAvatarImageValue("landmark")).toBe("");
    expect(accountAvatarRawEmoji("😀")).toBe("😀");
    expect(accountAvatarRawEmoji("wallet")).toBe("");
  });

  it("provides account picker options with portable avatars", () => {
    expect(accountPickerOption("Assets:Checking")).toEqual({
      value: "Assets:Checking",
      label: "Assets:Checking",
      imageUrl: accountAvatarImageDataUrl("Assets:Checking"),
    });
  });
});
