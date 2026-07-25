import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  test("joins native class values without a styling framework", () => {
    expect(
      cn("base", false, null, ["nested", { active: true, disabled: false }], {
        selected: 1,
      }),
    ).toBe("base nested active selected");
  });
});
