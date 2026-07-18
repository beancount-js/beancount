import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { intervalBoundaryDates } from "../core/ledger-data-class";
import type { Interval } from "../lib/interval";
import intervalEndsFixture from "./fixtures/interval-ends.json";

describe("interval ends parity with Fava util.date", () => {
  test.each(intervalEndsFixture.cases)(
    "$interval $begin → $end",
    ({ begin, end, interval, expectComplete, expectExact }) => {
      const first = DateTime.fromISO(begin, { zone: "utc" });
      const last = DateTime.fromISO(end, { zone: "utc" });
      const complete = intervalBoundaryDates(
        first,
        last,
        interval as Interval,
        true,
      ).map((date) => date.toISODate());
      const exact = intervalBoundaryDates(
        first,
        last,
        interval as Interval,
        false,
      ).map((date) => date.toISODate());
      expect(complete).toEqual(expectComplete);
      expect(exact).toEqual(expectExact);
    },
  );
});
