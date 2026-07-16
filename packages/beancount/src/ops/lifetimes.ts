import { DateTime } from "luxon";
import { Inventory, Transaction, type Directives } from "../core";

export type CommodityPair = readonly [
  currency: string,
  costCurrency: string | null,
];
export type LifetimeInterval = readonly [start: DateTime, end: DateTime | null];
export type CommodityLifetimes = Map<string, LifetimeInterval[]>;

export function commodityPairKey([currency, costCurrency]: CommodityPair) {
  return `${currency}\u0000${costCurrency ?? ""}`;
}

export function commodityPairFromKey(key: string): CommodityPair {
  const [currency, costCurrency = ""] = key.split("\u0000");
  return [currency, costCurrency || null];
}

function pairs(inventory: Inventory) {
  return new Set(
    inventory.positions.map((position) =>
      commodityPairKey([
        position.units.currency ?? "",
        position.cost?.amount?.currency ?? null,
      ]),
    ),
  );
}

/** Computes inclusive-start, exclusive-end active intervals for held commodity pairs. */
export function getCommodityLifetimes(entries: Directives): CommodityLifetimes {
  const lifetimes: CommodityLifetimes = new Map();
  const balances = new Map<string, Inventory>();
  let active = new Set<string>();
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    let changed = false;
    for (const posting of entry.postings) {
      const balance = balances.get(posting.account) ?? new Inventory();
      balances.set(posting.account, balance);
      const before = pairs(balance);
      balance.addPosting(posting);
      const after = pairs(balance);
      if (
        before.size !== after.size ||
        [...before].some((key) => !after.has(key))
      )
        changed = true;
    }
    if (!changed || !entry.date) continue;
    const next = new Set(
      [...balances.values()].flatMap((balance) => [...pairs(balance)]),
    );
    for (const key of next) {
      if (!active.has(key))
        (lifetimes.get(key) ?? lifetimes.set(key, []).get(key)!).push([
          entry.date,
          null,
        ]);
    }
    for (const key of active) {
      if (next.has(key)) continue;
      const intervals = lifetimes.get(key)!;
      const [start] = intervals.at(-1)!;
      intervals[intervals.length - 1] = [start, entry.date.plus({ days: 1 })];
    }
    active = next;
  }
  return lifetimes;
}

export function compressIntervalsDays(
  intervals: readonly LifetimeInterval[],
  numDays: number,
): LifetimeInterval[] {
  if (intervals.length < 2) return [...intervals];
  const compressed: LifetimeInterval[] = [];
  let [start, end] = intervals[0];
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (end && nextStart.diff(end, "days").days < numDays) {
      end = nextEnd;
    } else {
      compressed.push([start, end]);
      [start, end] = [nextStart, nextEnd];
    }
  }
  compressed.push([start, end]);
  return compressed;
}

export function trimIntervals(
  intervals: readonly LifetimeInterval[],
  trimStart: DateTime | null = null,
  trimEnd: DateTime | null = null,
): LifetimeInterval[] {
  if (trimStart && trimEnd && trimEnd < trimStart)
    throw new Error("Trim end date is before start date");
  return intervals.flatMap(([initialStart, initialEnd]) => {
    const start =
      trimStart && trimStart > initialStart ? trimStart : initialStart;
    const end =
      trimEnd && (!initialEnd || trimEnd < initialEnd) ? trimEnd : initialEnd;
    return !end || start <= end ? [[start, end] as LifetimeInterval] : [];
  });
}

export function compressLifetimesDays(
  lifetimes: CommodityLifetimes,
  numDays: number,
): CommodityLifetimes {
  return new Map(
    [...lifetimes].map(([key, intervals]) => [
      key,
      compressIntervalsDays(intervals, numDays),
    ]),
  );
}

export function requiredWeeklyPrices(
  lifetimes: CommodityLifetimes,
  lastDate: DateTime,
) {
  const required: Array<readonly [DateTime, string, string]> = [];
  for (const [key, intervals] of lifetimes) {
    const [currency, costCurrency] = commodityPairFromKey(key);
    if (!costCurrency) continue;
    for (const [start, initialEnd] of intervals) {
      const offset = 5 - start.weekday;
      let date = start.plus({ days: offset >= 1 ? offset - 7 : offset });
      const end = initialEnd ?? lastDate;
      while (date < end) {
        required.push([date, currency, costCurrency]);
        date = date.plus({ days: 7 });
      }
    }
  }
  return required.sort(([left], [right]) => left.toMillis() - right.toMillis());
}

export function requiredDailyPrices(
  lifetimes: CommodityLifetimes,
  lastDate: DateTime,
  weekdaysOnly = false,
) {
  const required: Array<readonly [DateTime, string, string]> = [];
  for (const [key, intervals] of lifetimes) {
    const [currency, costCurrency] = commodityPairFromKey(key);
    if (!costCurrency) continue;
    for (const [start, initialEnd] of intervals) {
      const end = initialEnd ?? lastDate;
      if (start >= end) continue;
      let date =
        weekdaysOnly && start.weekday > 5
          ? start.minus({ days: start.weekday - 5 })
          : start;
      while (date < end) {
        required.push([date, currency, costCurrency]);
        date = date.plus({ days: weekdaysOnly && date.weekday === 5 ? 3 : 1 });
      }
    }
  }
  return required.sort(([left], [right]) => left.toMillis() - right.toMillis());
}
