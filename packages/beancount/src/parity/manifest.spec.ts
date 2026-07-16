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
    const pending: ParityManifest = {
      ...(manifest as ParityManifest),
      records: [
        ...(manifest as ParityManifest).records,
        {
          upstreamModule: "beancount.parser.printer",
          upstreamBehavior: "synthetic_pending_coverage",
          localBehavior: "unimplemented",
          status: "pending",
          tests: [],
          reason: "Exercises the completion gate.",
        },
      ],
    };
    expect(validateParityCompletion(pending)).toEqual([
      "beancount.parser.printer:synthetic_pending_coverage is still pending",
    ]);
  });
});
