import type { DashboardCategory } from "./model";

export const dashboardFlowSurplusAccount = "__dashboard-flow-surplus";
export const dashboardFlowDeficitAccount = "__dashboard-flow-deficit";

export interface DashboardFlowBalance {
  cashFlow: number;
  sources: DashboardCategory[];
  targets: DashboardCategory[];
}

export interface PositionedDashboardFlow extends DashboardCategory {
  centerY: number;
  height: number;
  y: number;
}

export interface DashboardFlowLayout {
  centerHeight: number;
  centerY: number;
  scale: number;
  sources: PositionedDashboardFlow[];
  targets: PositionedDashboardFlow[];
  totalIn: number;
  totalOut: number;
}

/**
 * Balance the flow topology so its streams conserve value on both sides of Cash
 * flow. Positive cash flow becomes a Surplus leaf; a shortfall is shown as a
 * Deficit source.
 */
export function dashboardFlowBalance(
  inflows: DashboardCategory[],
  outflows: DashboardCategory[],
): DashboardFlowBalance {
  const sources = inflows.filter((entry) => entry.value > 0);
  const targets = outflows.filter((entry) => entry.value > 0);
  const totalIn = sources.reduce((sum, entry) => sum + entry.value, 0);
  const totalOut = targets.reduce((sum, entry) => sum + entry.value, 0);
  const cashFlow = totalIn - totalOut;

  if (cashFlow > 0) {
    return {
      cashFlow,
      sources,
      targets: [
        ...targets,
        {
          account: dashboardFlowSurplusAccount,
          color: "#10b981",
          label: "Surplus",
          value: cashFlow,
        },
      ],
    };
  }

  if (cashFlow < 0) {
    return {
      cashFlow,
      sources: [
        ...sources,
        {
          account: dashboardFlowDeficitAccount,
          color: "#ef4444",
          label: "Deficit",
          value: -cashFlow,
        },
      ],
      targets,
    };
  }

  return { cashFlow, sources, targets };
}

/**
 * Lay out the dashboard's fixed source -> cash-flow -> target topology.
 *
 * Link thickness is always proportional to value. Gaps are only introduced
 * between the side nodes, while each side's links remain tightly stacked at the
 * centre so their combined thickness can be compared accurately.
 */
export function dashboardFlowLayout(
  inflows: DashboardCategory[],
  outflows: DashboardCategory[],
  height: number,
  padding = 16,
  gap = 8,
): DashboardFlowLayout {
  const sources = inflows.filter((entry) => entry.value > 0);
  const targets = outflows.filter((entry) => entry.value > 0);
  const totalIn = sources.reduce((sum, entry) => sum + entry.value, 0);
  const totalOut = targets.reduce((sum, entry) => sum + entry.value, 0);
  const maximumTotal = Math.max(totalIn, totalOut);
  const maximumCount = Math.max(sources.length, targets.length);
  const availableHeight = Math.max(
    0,
    height - padding * 2 - Math.max(maximumCount - 1, 0) * gap,
  );
  const scale = maximumTotal ? availableHeight / maximumTotal : 0;
  const centerHeight = maximumTotal * scale;
  const centerY = (height - centerHeight) / 2;

  function position(entries: DashboardCategory[]): PositionedDashboardFlow[] {
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const linksHeight = total * scale;
    const nodesHeight = linksHeight + Math.max(entries.length - 1, 0) * gap;
    let y = (height - nodesHeight) / 2;
    let centerOffset = centerY + (centerHeight - linksHeight) / 2;

    return entries.map((entry) => {
      const flowHeight = entry.value * scale;
      const positioned = {
        ...entry,
        centerY: centerOffset,
        height: flowHeight,
        y,
      };
      y += flowHeight + gap;
      centerOffset += flowHeight;
      return positioned;
    });
  }

  return {
    centerHeight,
    centerY,
    scale,
    sources: position(sources),
    targets: position(targets),
    totalIn,
    totalOut,
  };
}
