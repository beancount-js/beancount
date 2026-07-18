import { describe, expect, test } from "vitest";
import manifest from "./manifest.json";
import {
  UPSTREAM_COMMIT,
  validateParityManifest,
  type ParityManifest,
} from "./manifest";

describe("fava report parity manifest", () => {
  test("is consistent with the pinned Fava commit", () => {
    expect((manifest as ParityManifest).upstreamCommit).toBe(UPSTREAM_COMMIT);
    expect(validateParityManifest(manifest as ParityManifest)).toEqual([]);
  });
});
