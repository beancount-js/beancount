import { describe, expect, test } from "vitest";
import { MONZO_PROVIDER_CATEGORIES, monzoProviderCategory } from "./categories";

describe("Monzo provider categories", () => {
  test("exposes every documented transaction category including top ups", () => {
    expect(MONZO_PROVIDER_CATEGORIES).toHaveLength(11);
    expect(MONZO_PROVIDER_CATEGORIES).toEqual(
      expect.arrayContaining([
        { code: "groceries", label: "Groceries" },
        { code: "mondo", label: "Top ups" },
      ]),
    );
  });

  test("normalizes category codes without rejecting future values", () => {
    expect(monzoProviderCategory(" SHOPPING ")).toEqual({
      provider: "monzo",
      code: "shopping",
      label: "Shopping",
    });
    expect(monzoProviderCategory("future_bucket")).toEqual({
      provider: "monzo",
      code: "future_bucket",
      label: "Future Bucket",
    });
    expect(monzoProviderCategory(" ")).toBeUndefined();
  });
});
