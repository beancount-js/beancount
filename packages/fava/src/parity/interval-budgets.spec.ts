import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { LedgerSource } from "../core/ledger";

const sampleBudgets = resolve(
  import.meta.dirname,
  "../../../../sample-budgets.beancount",
);

describe("intervalBudgets parity", () => {
  test.skipIf(!existsSync(sampleBudgets))(
    "exposes non-empty budgets for Expenses:Food:Restaurant on sample-budgets",
    () => {
      const source = new LedgerSource(readFileSync(sampleBudgets, "utf8"), {
        logTimings: undefined,
      });
      const budgets = source.data.intervalBudgets(
        "Expenses:Food:Restaurant",
        "month",
        false,
      );
      expect(budgets["Expenses:Food:Restaurant"]).toBeDefined();
      expect(budgets["Expenses:Food:Restaurant"]!.length).toBeGreaterThan(0);
      const first = budgets["Expenses:Food:Restaurant"]![0]!;
      expect(first.budget.USD ?? first.budgetChildren.USD).toBeGreaterThan(0);

      const parent = source.data.intervalBudgets("Expenses", "month", true);
      expect(parent["Expenses:Food:Restaurant"]).toBeDefined();
      const childBudget = parent["Expenses:Food:Restaurant"]![0]!;
      expect(
        Object.keys(childBudget.budget).length +
          Object.keys(childBudget.budgetChildren).length,
      ).toBeGreaterThan(0);
    },
  );
});
