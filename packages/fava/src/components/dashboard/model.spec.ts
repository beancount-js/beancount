import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";

import { chartCategories, dashboardRange } from "./model";

describe("dashboard model", () => {
  test("uses today as an inclusive end for the active period", () => {
    const now = DateTime.fromISO("2026-07-15T10:30:00");

    const range = dashboardRange("ytd", DateTime.fromISO("2024-01-01"), now);

    expect(range.from.toISODate()).toBe("2026-01-01");
    expect(range.endInclusive.toISODate()).toBe("2026-07-15");
    expect(range.contains(DateTime.fromISO("2026-07-16"))).toBe(false);
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
});
