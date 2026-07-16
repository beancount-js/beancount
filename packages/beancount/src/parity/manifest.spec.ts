import { describe, expect, test } from "vitest";
import manifest from "./manifest.json";
import { type ParityManifest, validateParityManifest } from "./manifest";

describe("parity manifest", () => {
  test("is internally consistent", () => {
    expect(validateParityManifest(manifest as ParityManifest)).toEqual([]);
  });
});
