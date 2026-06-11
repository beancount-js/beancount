import { describe, expect, test } from "vitest";
import { chunk, stringify } from "./helpers";

describe("helpers", () => {
  test("chunk splits arrays", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("stringify renders primitives", () => {
    expect(stringify(null)).toBe("");
    expect(stringify("hello")).toBe("hello");
  });
});
