import { describe, test, expect } from "vitest";
import { Amount } from "./amount";

describe("Decimal", () => {
  test("scaleb", () => {
    expect(new Amount("1.000").scaleb(-2)).toEqual(new Amount("0.01"));
  });

  test("precision", () => {
    expect(new Amount("0.000")).toEqual(new Amount("0.000"));
  });

  test("copies a missing numeric value while replacing its currency", () => {
    const missing = new Amount(null, "HOOL");
    const copy = missing.copy({ currency: "USD" });

    expect(copy.currency).toBe("USD");
    expect(copy.isDefined()).toBe(false);
  });
});
