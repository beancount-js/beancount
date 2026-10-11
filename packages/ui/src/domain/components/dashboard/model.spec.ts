import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";

import {
  chartCategories,
  dashboardDefaultCurrency,
  dashboardPercentageChange,
  dashboardRange,
  dashboardSeriesWithBounds,
  dashboardTrendTone,
} from "./model";

describe("dashboard model", () => {
  test("uses today as an inclusive end for the active period", () => {
    const now = DateTime.fromISO("2026-07-15T10:30:00");

    const range = dashboardRange("ytd", DateTime.fromISO("2024-01-01"), now);

    expect(range.from.toISODate()).toBe("2026-01-01");
    expect(range.endInclusive.toISODate()).toBe("2026-07-15");
    expect(range.contains(DateTime.fromISO("2026-07-16"))).toBe(false);
  });

  test("prefers the configured operating currency for dashboard display", () => {
    expect(dashboardDefaultCurrency(["GLD", "USD", "VEA"], ["USD"])).toBe(
      "USD",
    );
    expect(dashboardDefaultCurrency(["GLD", "VEA"], ["USD"])).toBe("GLD");
  });

  test("retains the total when long category lists are collapsed into Other", () => {
    const categories = Array.from({ length: 10 }, (_, index) => ({
      account: `Expenses:Category:${index}`,
      label: `Category ${index}`,
      value: 10 - index,
      color: "#7667d9",
    }));

    const visible = chartCategories(categories, 3);

    expect(visible).toHaveLength(4);
    expect(visible.map((entry) => entry.label)).toEqual([
      "Category 0",
      "Category 1",
      "Category 2",
      "Other",
    ]);
    expect(visible.reduce((sum, entry) => sum + entry.value, 0)).toBe(55);
  });

  test("calculates signed net-worth change against the absolute start value", () => {
    expect(dashboardPercentageChange(100, 125)).toBe(25);
    expect(dashboardPercentageChange(-100, -125)).toBe(-25);
    expect(dashboardPercentageChange(0, 50)).toBeNull();
  });

  test("selects semantic trend tones for positive, negative, and flat periods", () => {
    expect(dashboardTrendTone(0.01)).toBe("positive");
    expect(dashboardTrendTone(-0.01)).toBe("negative");
    expect(dashboardTrendTone(0)).toBe("neutral");
  });

  test("adds exact period bounds without duplicating interval points", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-07-15T23:59:59.999Z");
    const points = dashboardSeriesWithBounds(
      [
        { date: start, value: 5 },
        { date: new Date("2026-02-28T00:00:00.000Z"), value: 20 },
        { date: end, value: 40 },
      ],
      start,
      end,
      10,
      50,
    );

    expect(points).toEqual([
      { date: start, value: 10 },
      { date: new Date("2026-02-28T00:00:00.000Z"), value: 20 },
      { date: end, value: 50 },
    ]);
  });
});
