import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { formatDate } from "@beancount-js/parser";
import { LedgerSource } from "../core/ledger";

const exampleLedger = resolve(
  import.meta.dirname,
  "../../../../../fava-upstream/contrib/examples/example.beancount",
);

describe("account_report interval bounds parity", () => {
  test.skipIf(!existsSync(exampleLedger))(
    "uses full-ledger month spans for account reports (Fava `a` is not an entry filter)",
    () => {
      const source = new LedgerSource(readFileSync(exampleLedger, "utf8"));
      const months = source.data.dateRanges("month");
      expect(months.length).toBe(33);
      expect(formatDate(months[0].from)).toBe("2015-01-01");
      expect(formatDate(months.at(-1)!.from)).toBe("2017-09-01");

      // Account node is taken from the unfiltered interval trees.
      const equityNode = source.data
        .balanceTrees("month")[0]
        .tree.get("Equity");
      expect(equityNode.account).toBe("Equity");
    },
  );
});
