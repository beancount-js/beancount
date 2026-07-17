import { describe, expect, test } from "vitest";
import { brandfetchLogoUrl, isValidDomain } from "./brandfetch";

describe("Brandfetch Logo API", () => {
  test("builds a direct Logo API URL using the client ID", () => {
    expect(brandfetchLogoUrl("Tesco.COM", "client id")).toBe(
      "https://cdn.brandfetch.io/domain/tesco.com/h/128/w/128/icon.png?c=client%20id",
    );
  });

  test("accepts public domains and rejects invalid identifiers", () => {
    expect(isValidDomain("starlingbank.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("https://starlingbank.com")).toBe(false);
  });
});
