import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  UPSTREAM_COMMIT,
  validateParityManifest,
  type ParityManifest,
} from "./manifest";

const manifestPath = fileURLToPath(new URL("./manifest.json", import.meta.url));

describe("beanquery parity manifest", () => {
  test("is consistent with the pinned Fava commit", () => {
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as ParityManifest;
    expect(manifest.upstreamCommit).toBe(UPSTREAM_COMMIT);
    expect(validateParityManifest(manifest)).toEqual([]);
  });
});
