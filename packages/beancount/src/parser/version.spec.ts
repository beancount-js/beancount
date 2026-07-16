import { describe, expect, test } from "vitest";
import { computeVersionString } from "./version";

describe("computeVersionString", () => {
  test("matches upstream changeset shortening and UTC date rendering", () => {
    expect(
      computeVersionString(
        "2.1.0",
        "hg:e291c91b37e1d21c29645d93473a7917bb726699",
        1526099371,
      ),
    ).toBe("Beancount 2.1.0 (hg:e291c91b37e1; 2018-05-12)");
    expect(
      computeVersionString(
        "2.1.0",
        "git:e291c91b37e1d21c29645d93473",
        1526099371,
      ),
    ).toBe("Beancount 2.1.0 (git:e291c91b; 2018-05-12)");
  });

  test("omits unavailable native build metadata", () => {
    expect(computeVersionString("2.1.0", "", 0)).toBe("Beancount 2.1.0");
  });
});
