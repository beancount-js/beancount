import { describe, expect, test } from "vitest";

import type { DashboardCategory } from "./model";
import {
  dashboardFlowBalance,
  dashboardFlowDeficitAccount,
  dashboardFlowLayout,
  dashboardFlowSurplusAccount,
} from "./geometry";

function category(label: string, value: number): DashboardCategory {
  return {
    account: `Account:${label}`,
    color: "#7667d9",
    label,
    value,
  };
}

describe("dashboard flow geometry", () => {
  test("keeps stream thickness proportional and conserves both totals", () => {
    const layout = dashboardFlowLayout(
      [category("Salary", 75), category("Refund", 25)],
      [category("Bills", 50), category("Food", 20), category("Other", 10)],
      340,
    );

    expect(layout.totalIn).toBe(100);
    expect(layout.totalOut).toBe(80);
    expect(
      layout.sources.reduce((sum, entry) => sum + entry.height, 0),
    ).toBeCloseTo(layout.totalIn * layout.scale);
    expect(
      layout.targets.reduce((sum, entry) => sum + entry.height, 0),
    ).toBeCloseTo(layout.totalOut * layout.scale);
    expect(layout.sources[0].height / layout.sources[1].height).toBeCloseTo(3);
  });

  test("preserves source order and does not inflate tiny categories", () => {
    const layout = dashboardFlowLayout(
      [category("Large", 999), category("Tiny", 1)],
      [category("Destination", 1000)],
      340,
    );

    expect(layout.sources.map((entry) => entry.label)).toEqual([
      "Large",
      "Tiny",
    ]);
    expect(layout.sources[1].height).toBeCloseTo(layout.scale);
    expect(layout.sources[0].height / layout.sources[1].height).toBeCloseTo(
      999,
    );
  });

  test("adds a surplus leaf so positive cash flow is visible and conserved", () => {
    const flow = dashboardFlowBalance(
      [category("Salary", 100)],
      [category("Bills", 80)],
    );
    const layout = dashboardFlowLayout(flow.sources, flow.targets, 340);

    expect(flow.cashFlow).toBe(20);
    expect(flow.targets.at(-1)).toMatchObject({
      account: dashboardFlowSurplusAccount,
      label: "Surplus",
      value: 20,
    });
    expect(layout.totalIn).toBe(layout.totalOut);
  });

  test("adds a deficit source when outflows exceed inflows", () => {
    const flow = dashboardFlowBalance(
      [category("Salary", 80)],
      [category("Bills", 100)],
    );

    expect(flow.cashFlow).toBe(-20);
    expect(flow.sources.at(-1)).toMatchObject({
      account: dashboardFlowDeficitAccount,
      label: "Deficit",
      value: 20,
    });
  });

  test("returns an empty, finite layout when there is no activity", () => {
    const layout = dashboardFlowLayout([], [], 340);

    expect(layout.sources).toEqual([]);
    expect(layout.targets).toEqual([]);
    expect(layout.centerHeight).toBe(0);
    expect(layout.scale).toBe(0);
  });
});
