import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { DateRange } from "@beancount-js/filters";
import { Amount } from "../core";
import { Budget, calculateBudgetChildren } from "./budget";

describe("budget plugin", () => {
  test("includes descendant budgets when the parent has no direct budget", () => {
    const date = DateTime.fromISO("2024-01-01");
    const budgets = new Map([
      [
        "Expenses:Food",
        [new Budget(date, "Expenses:Food", "day", new Amount("30", "USD"))],
      ],
      [
        "Expenses:Travel",
        [new Budget(date, "Expenses:Travel", "day", new Amount("20", "USD"))],
      ],
    ]);

    expect(
      calculateBudgetChildren(
        budgets,
        "Expenses",
        new DateRange(date, date.plus({ day: 1 })),
      ),
    ).toEqual({ USD: 50 });
  });
});
