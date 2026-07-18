import { describe, expect, test } from "vitest";
import {
  STARLING_PROVIDER_CATEGORIES,
  starlingProviderCategory,
} from "./categories";

describe("Starling provider categories", () => {
  test("exposes the complete current public OpenAPI catalogue", () => {
    expect(STARLING_PROVIDER_CATEGORIES).toHaveLength(154);
    expect(STARLING_PROVIDER_CATEGORIES).toEqual(
      expect.arrayContaining([
        { code: "GROCERIES", label: "Groceries" },
        { code: "BILLS_AND_SERVICES", label: "Bills And Services" },
        { code: "PAYE_AND_NI", label: "PAYE and NI" },
      ]),
    );
  });

  test("normalizes category codes without rejecting future values", () => {
    expect(starlingProviderCategory(" groceries ")).toEqual({
      provider: "starling",
      code: "GROCERIES",
      label: "Groceries",
    });
    expect(starlingProviderCategory("future_bucket")).toEqual({
      provider: "starling",
      code: "FUTURE_BUCKET",
      label: "Future Bucket",
    });
    expect(starlingProviderCategory(" ")).toBeUndefined();
  });
});
