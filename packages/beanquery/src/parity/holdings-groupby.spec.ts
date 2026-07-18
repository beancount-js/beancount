import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { Inventory, loadString } from "@beancount-js/beancount";
import { runBql } from "..";
import holdingsFixture from "./fixtures/holdings-groupby.json";

const exampleLedger = resolve(
  import.meta.dirname,
  "../../../../../fava-upstream/contrib/examples/example.beancount",
);
const queryExampleLedger = resolve(
  import.meta.dirname,
  "../../../../../fava-upstream/tests/data/query-example.beancount",
);

describe("holdings-style GROUP BY parity", () => {
  test.skipIf(!existsSync(exampleLedger))(
    "matches Fava row count on example.beancount",
    () => {
      const [dirs, errors, options] = loadString(
        readFileSync(exampleLedger, "utf8"),
      );
      const result = runBql(dirs, holdingsFixture.scenario.query, {
        errors,
        options,
      });
      expect(result.error).toBeUndefined();
      expect(result.data.length).toBe(holdingsFixture.oracle.exampleRowCount);
      const units = result.data[0]?.["units(sum(position))"];
      expect(units).toBeInstanceOf(Inventory);
    },
  );

  test.skipIf(!existsSync(queryExampleLedger))(
    "matches Fava row count on query-example.beancount",
    () => {
      const [dirs, errors, options] = loadString(
        readFileSync(queryExampleLedger, "utf8"),
      );
      const result = runBql(dirs, holdingsFixture.scenario.query, {
        errors,
        options,
      });
      expect(result.error).toBeUndefined();
      expect(result.data.length).toBe(
        holdingsFixture.oracle.queryExampleRowCount,
      );
    },
  );
});
