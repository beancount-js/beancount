import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { AccountFilter } from "@beancount-js/filters";
import { LedgerSource } from "../core/ledger";
import accountFilterFixture from "./fixtures/account-filter.json";

const exampleLedger = resolve(
  import.meta.dirname,
  "../../../../../fava-upstream/tests/data/long-example.beancount",
);

describe("AccountFilter parity", () => {
  test.skipIf(!existsSync(exampleLedger))(
    "matches Fava account-filter entry counts on example.beancount",
    () => {
      const source = new LedgerSource(readFileSync(exampleLedger, "utf8"));
      for (const testCase of accountFilterFixture.scenario.cases) {
        const filtered = source.data.filter(AccountFilter.of(testCase.account));
        expect(filtered.directives.length).toBe(testCase.expectedCount);
      }
    },
  );

  test("keeps payee when narration is an empty string", () => {
    const source = new LedgerSource(`
      2015-01-08 * "EDISON POWER" ""
        Assets:Cash                     1.00 USD
        Equity:Opening-Balances
    `);
    const txn = source.directives.find(
      (directive) => directive.directiveType === "transaction",
    ) as { payee?: string; narration?: string } | undefined;
    expect(txn?.payee).toBe("EDISON POWER");
    expect(txn?.narration).toBe("");
  });
});
