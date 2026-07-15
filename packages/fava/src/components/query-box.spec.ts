import { describe, expect, it } from "vitest";
import { nextOpenQueryState } from "./query-box";

describe("nextOpenQueryState", () => {
  it("opens an existing saved query", () => {
    expect(nextOpenQueryState({ first: false }, ["first"])).toEqual({
      first: true,
    });
  });

  it("preserves closed saved queries while updating expanded queries", () => {
    expect(
      nextOpenQueryState({ first: true, second: true }, ["second", "third"]),
    ).toEqual({ first: false, second: true, third: true });
  });
});
