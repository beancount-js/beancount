import { describe, test, expect } from "vitest";
import { checksum } from "./hash";

describe("Hash", () => {
  test("empty string", () => {
    expect(checksum("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  test("hello", () => {
    expect(checksum("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });
});
