import { describe, expect, test } from "vitest";
import { Distribution } from "./distribution";

describe("distribution", () => {
  test("tracks bounds and the highest value when modes tie", () => {
    const distribution = new Distribution();
    expect(distribution.empty()).toBe(true);
    [1, 2, 2, 2, 3, 3, 4].forEach((value) => distribution.update(value));
    expect(distribution.empty()).toBe(false);
    expect(distribution.min()).toBe(1);
    expect(distribution.max()).toBe(4);
    expect(distribution.mode()).toBe(2);
    distribution.update(3);
    expect(distribution.mode()).toBe(3);
  });

  test("merges histogram samples from another distribution", () => {
    const left = new Distribution();
    [1, 2, 2, 3].forEach((value) => left.update(value));
    const right = new Distribution();
    [2, 3, 3, 3, 4].forEach((value) => right.update(value));
    left.updateFrom(right);
    expect([left.min(), left.max(), left.mode()]).toEqual([1, 4, 3]);
  });
});
