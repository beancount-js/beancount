import { describe, expect, test } from "vitest";
import { CaseInsensitiveMap, DefaultKeyedMap, DefaultMap } from "./map";

class Key {
  constructor(readonly hash: string) {}
}

describe("map helpers", () => {
  test("creates and retains default values", () => {
    const map = new DefaultMap((key: string) => key.length);

    expect(map.get("abc")).toBe(3);
    expect(map.get("abc")).toBe(3);
    expect(map.map(([key, value]) => [key.toUpperCase(), value])).toEqual({
      ABC: 3,
    });
  });

  test("canonicalizes initial and later keyed entries by hash", () => {
    const map = new DefaultKeyedMap<Key, number>(
      () => 0,
      [[new Key("lot"), 1]],
    );

    expect(map.get(new Key("lot"))).toBe(1);
    expect(map.size).toBe(1);
    map.set(new Key("lot"), 2);
    expect(map.size).toBe(1);
    expect(map.get(new Key("lot"))).toBe(2);
    expect(map.delete(new Key("lot"))).toBe(true);
    expect(map.size).toBe(0);
  });

  test("normalizes string keys without changing non-string keys", () => {
    const map = new CaseInsensitiveMap<string | number, string>();
    map.set("USD", "dollar");
    map.set(1, "one");

    expect(map.get("usd")).toBe("dollar");
    expect(map.has("uSd")).toBe(true);
    expect(map.get(1)).toBe("one");
  });
});
