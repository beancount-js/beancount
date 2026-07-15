import { describe, expect, it } from "vitest";
import { pickProjectDirectoryFromSystemDialog } from "./pick-directory";

describe("pickProjectDirectoryFromSystemDialog", () => {
  it("returns null on unsupported platforms", () => {
    if (
      process.platform === "darwin" ||
      process.platform === "linux" ||
      process.platform === "win32"
    ) {
      expect(typeof pickProjectDirectoryFromSystemDialog).toBe("function");
      return;
    }
    expect(pickProjectDirectoryFromSystemDialog()).toBeNull();
  });
});
