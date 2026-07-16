import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { DateRange } from "@beancount-js/filters";
import { Amount } from "../core";
import { Custom } from "../core/data";
import {
  Budget,
  BudgetModule,
  calculateBudget,
  calculateBudgetChildren,
  daysInPeriod,
  matchingBudgets,
  parseBudgets,
} from "./budget";

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

  test("parses valid directives and reports each invalid budget field", () => {
    const date = DateTime.fromISO("2024-01-01");
    const valid = new Custom(date, "budget", [
      "Expenses:Food",
      "monthly",
      new Amount("310", "USD"),
    ]);
    const [budgets, errors] = parseBudgets([
      valid,
      new Custom(date, "budget", []),
      new Custom(date, "budget", [1, "monthly", new Amount("1", "USD")]),
      new Custom(date, "budget", [
        "Expenses:Food",
        "hourly",
        new Amount("1", "USD"),
      ]),
      new Custom(date, "budget", ["Expenses:Food", "monthly", "1 USD"]),
    ]);

    expect(errors).toHaveLength(4);
    expect(budgets.get("Expenses:Food")).toEqual([
      new Budget(date, "Expenses:Food", "month", new Amount("310", "USD")),
    ]);
    expect(
      calculateBudget(
        budgets,
        "Expenses:Food",
        new DateRange(date, date.plus({ day: 1 })),
      ),
    ).toEqual({ USD: 10 });
    expect(
      calculateBudget(budgets, "Expenses:Missing", new DateRange(date, date)),
    ).toEqual({});
  });

  test("uses the latest active currency budget and exposes period lengths", () => {
    const date = DateTime.fromISO("2024-02-15");
    const budgets = [
      new Budget(
        date.minus({ month: 1 }),
        "Expenses:Food",
        "week",
        new Amount("7", "USD"),
      ),
      new Budget(date, "Expenses:Food", "day", new Amount("2", "USD")),
    ];

    expect(matchingBudgets(budgets, date).USD).toBe(budgets[1]);
    expect(daysInPeriod("day", date)).toBe(1);
    expect(daysInPeriod("week", date)).toBe(7);
    expect(daysInPeriod("month", date)).toBe(29);

    const ledger = {
      directives: [
        new Custom(date, "budget", [
          "Expenses:Food",
          "daily",
          new Amount("2", "USD"),
        ]),
      ],
      errors: [],
    };
    expect(
      new BudgetModule(ledger).calculate(
        "Expenses:Food",
        new DateRange(date, date.plus({ day: 1 })),
      ),
    ).toEqual({ USD: 2 });
  });
});
