import { describe, expect, test } from "vitest";
import { brandfetchLogoUrl, isValidDomain } from "./brandfetch";

describe("Brandfetch Logo API", () => {
  test("builds a Logo API URL using the requested resolution", () => {
    expect(brandfetchLogoUrl("Tesco.COM", "client id")).toBe(
      "https://cdn.brandfetch.io/tesco.com/h/40/w/40/icon.png?c=client%20id",
    );
    expect(brandfetchLogoUrl("tesco.com", "client", 120)).toContain(
      "/h/120/w/120/",
    );
  });

  test("accepts public domains and rejects invalid identifiers", () => {
    expect(isValidDomain("starlingbank.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("https://starlingbank.com")).toBe(false);
  });
});
