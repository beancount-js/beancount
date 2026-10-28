import type { DurationLikeObject } from "luxon";

export type Interval = "year" | "quarter" | "month" | "week" | "day";

export const DEFAULT_INTERVAL: Interval = "month";

export const INTERVALS: Interval[] = [
  "year",
  "quarter",
  "month",
  "week",
  "day",
];

export function getInterval(s: string | null): Interval {
  return INTERVALS.includes(s as Interval) ? (s as Interval) : DEFAULT_INTERVAL;
}

export function getDuration(
  s: string | null | Interval,
  units: number,
): DurationLikeObject {
  const interval = getInterval(s);
  switch (interval) {
    case "year":
      return { year: units };
    case "quarter":
      return { quarter: units };
    case "month":
      return { month: units };
    case "week":
      return { week: units };
    case "day":
      return { day: units };
  }
  return {};
}

/** Get the translateable label for an interval. */
export function intervalLabel(s: Interval): string {
  return {
    year: "Yearly",
    quarter: "Quarterly",
    month: "Monthly",
    week: "Weekly",
    day: "Daily",
  }[s];
}
