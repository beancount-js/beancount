import { describe, expect, test } from "vitest";
import manifest from "./manifest.json";
import {
  type ParityManifest,
  validateParityCompletion,
  validateParityManifest,
} from "./manifest";

describe("parity manifest", () => {
  test("is internally consistent", () => {
    expect(validateParityManifest(manifest as ParityManifest)).toEqual([]);
  });

  test("does not report completion while in-scope work is pending", () => {
    expect(validateParityCompletion(manifest as ParityManifest)).toHaveLength(
      3,
    );
  });
});
