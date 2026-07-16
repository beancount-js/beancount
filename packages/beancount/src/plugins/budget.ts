import { Amount } from "../core/amount";

import { ValidationError } from "../ops/validation";
import { isDescendantOf } from "../core/account";
import { DateRange, getDuration } from "@beancount-js/filters";
import type { Interval } from "@beancount-js/filters";
import { Custom } from "../core/data";
import type { Directives } from "../core/data";
import { DefaultMap } from "../core";
import { DateTime } from "luxon";
import type { LedgerError } from "../parser/loader";

export class Budget {
  constructor(
    readonly date: DateTime,
    readonly account: string,
    readonly period: Interval,
    readonly amount: Amount,
  ) {}
}

export type BudgetDict = Map<string, Array<Budget>>;

export class BudgetModule {
  readonly entries: BudgetDict;
  constructor(ledger: { errors: Array<LedgerError>; directives: Directives }) {
    const [entries, errors] = parseBudgets(ledger.directives);
    this.entries = entries;
    ledger.errors.push(...errors);
  }

  calculate(account: string, dateRange: DateRange): Record<string, number> {
    return calculateBudget(this.entries, account, dateRange);
  }

  calculateChildren(
    account: string,
    dateRange: DateRange,
  ): Record<string, number> {
    return calculateBudgetChildren(this.entries, account, dateRange);
  }
}

/**
 * Parse budget directives from custom entries.
 *
 * @param customEntries The Custom entries to parse budgets from.
 */
export function parseBudgets(
  customEntries: Directives,
): [BudgetDict, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  const budgets = new DefaultMap<string, Array<Budget>>(() => []);
  const intervalMap: Record<string, Interval> = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    quarterly: "quarter",
    yearly: "year",
  };

  const budgetDirectives = customEntries
    .filter((it) => it instanceof Custom)
    .filter((it) => it.type === "budget");

  for (const entry of budgetDirectives) {
    if (entry.values.length < 3) {
      errors.push(
        new ValidationError(`invalid values for budget: ${entry.values}`, {
          entry,
        }),
      );
      continue;
    }

    const [account, freq, amount] = entry.values;
    if (!(typeof account === "string")) {
      errors.push(
        new ValidationError(`invalid values for budget account: ${account}`, {
          entry,
        }),
      );
      continue;
    }

    if (!(typeof freq === "string") || !intervalMap[freq]) {
      errors.push(
        new ValidationError(`invalid values for budget interval: ${freq}`, {
          entry,
        }),
      );
      continue;
    }

    if (!(amount instanceof Amount)) {
      errors.push(
        new ValidationError(`invalid values for budget amount: ${amount}`, {
          entry,
        }),
      );
      continue;
    }

    budgets
      .get(account)
      .push(new Budget(entry.date, account, intervalMap[freq], amount));
  }

  return [budgets, errors];
}

/**
 * Find matching budgets.
 *
 * @param budgets The budget that is active on the specified date for the
 *   specified account.
 * @param date
 * @returns
 */
export function matchingBudgets(
  budgets: readonly Budget[],
  date: DateTime,
): Record<string, Budget> {
  const lastSeenBudgets: Record<string, Budget> = {};
  for (const budget of budgets) {
    if (budget.date <= date) {
      lastSeenBudgets[budget.amount.currency!] = budget;
    }
  }
  return lastSeenBudgets;
}

export function daysInPeriod(interval: Interval, date: DateTime) {
  switch (interval) {
    case "day":
      return 1;
    case "week":
      return 7;
  }
  const a = date.startOf(interval);
  const b = a.plus(getDuration(interval, 1));
  return b.diff(a, "days").days;
}

/**
 * Calculate budget for an account.
 *
 * @param budgets A list of :class:`Budget` entries.
 * @param account An account name.
 * @param dateRange Date range for the budget
 * @returns A dictionary of currency to Decimal with the budget for the
 *   specified account and period.
 */
export function calculateBudget(
  budgets: BudgetDict,
  account: string,
  dateRange: DateRange,
): Record<string, number> {
  const currentDict: Record<string, number> = {};
  if (!budgets.has(account)) {
    return currentDict;
  }

  return calculateBudgetList(budgets.get(account)!, dateRange);
}

function calculateBudgetList(
  budgetList: readonly Budget[],
  dateRange: DateRange,
): Record<string, number> {
  const currentDict: Record<string, number> = {};
  for (const day of dateRange.intervals("day")) {
    const matches = matchingBudgets(budgetList, day as DateTime);
    for (const [currency, budget] of Object.entries(matches)) {
      const units = daysInPeriod(budget.period, day as DateTime);
      currentDict[currency] ||= 0;
      currentDict[currency] += budget.amount.div(units).number;
    }
  }
  return currentDict;
}

/**
 * Calculate budget for an account including budgets of its children.
 *
 * @param budgets A list of :class:`Budget` entries.
 * @param account An account name.
 * @param dateRange Date range for the budget
 * @returns A dictionary of currency to Decimal with the budget for the
 *   specified account and period.
 */
export function calculateBudgetChildren(
  budgets: BudgetDict,
  account: string,
  dateRange: DateRange,
): Record<string, number> {
  const currentDict: Record<string, number> = {};
  for (const [acc, budgetList] of budgets.entries()) {
    if (isDescendantOf(account, acc)) {
      const values = calculateBudgetList(budgetList, dateRange);
      for (const [key, value] of Object.entries(values)) {
        currentDict[key] ||= 0;
        currentDict[key] += value;
      }
    }
  }
  return currentDict;
}
