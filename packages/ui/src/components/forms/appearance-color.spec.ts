import { describe, expect, it } from "vitest";
import {
  appearanceIconContrast,
  appearanceIconForeground,
  autoCorrectAppearanceColor,
  needsAppearanceContrastCorrection,
} from "./appearance-color";

describe("account appearance colours", () => {
  it("uses a darker generated icon colour for tinted account avatars", () => {
    expect(appearanceIconForeground("#F59E0B")).toBe("#875706");
    expect(needsAppearanceContrastCorrection("#F59E0B")).toBe(false);
  });

  it("flags custom colours whose generated icon colour lacks contrast", () => {
    expect(needsAppearanceContrastCorrection("#FFFFFF")).toBe(true);
    expect(appearanceIconContrast("#FFFFFF")).toBeLessThan(4.5);
  });

  it("auto-corrects an inaccessible custom colour to AA contrast", () => {
    const corrected = autoCorrectAppearanceColor("#FFFFFF");

    expect(corrected).not.toBe("#FFFFFF");
    expect(corrected).not.toBeNull();
    expect(needsAppearanceContrastCorrection(corrected!)).toBe(false);
    expect(appearanceIconContrast(corrected!)).toBeGreaterThanOrEqual(4.5);
  });
});
