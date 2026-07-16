import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Commodity } from "../core";
import { validateCommodityAttributes } from "./commodity_attr";

describe("commodity attribute plugin", () => {
  test("reports missing and invalid configured commodity attributes", () => {
    const date = DateTime.fromISO("2018-08-02");
    const missing = new Commodity(date, "BNDX");
    const invalid = new Commodity(date, "VNQ", { strategy: "bond" });
    const [, errors] = validateCommodityAttributes(
      [
        new Commodity(date, "AAPL", { strategy: "bigtech" }),
        new Commodity(date, "BND", { strategy: "bonds" }),
        missing,
        invalid,
      ],
      undefined,
      "{ strategy: [bigtech, bonds] }",
    );

    expect(errors.map((error) => error.message)).toEqual([
      "Missing attribute 'strategy' for Commodity directive BNDX",
      "Invalid value 'bond' for attribute strategy, Commodity directive VNQ; valid options: bigtech, bonds",
    ]);
    expect(errors[0].context.directive).toBe(missing);
    expect(errors[1].context.directive).toBe(invalid);
  });

  test("allows any present value for a null enumeration and rejects invalid configuration", () => {
    const date = DateTime.fromISO("2018-08-02");
    const [, errors] = validateCommodityAttributes(
      [
        new Commodity(date, "AAPL", { strategy: "bigtech" }),
        new Commodity(date, "BND"),
      ],
      undefined,
      "{ strategy: null }",
    );
    const [, configErrors] = validateCommodityAttributes(
      [],
      undefined,
      "[strategy]",
    );

    expect(errors.map((error) => error.message)).toEqual([
      "Missing attribute 'strategy' for Commodity directive BND",
    ]);
    expect(configErrors[0].message).toBe(
      "Invalid configuration for commodity_attr plugin; skipping.",
    );
  });
});
