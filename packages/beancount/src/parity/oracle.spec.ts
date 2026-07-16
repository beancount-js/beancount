import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { getLastPriceEntries } from "../core/prices";
import { Transaction } from "../core/data";
import { loadProjectSources, loadString } from "../parser/loader";
import { canonicalize } from "./canonical";
import loaderFixture from "./fixtures/loader-recursive-relative-includes.json";
import pricesFixture from "./fixtures/prices-last-price-entries.json";
import bookingFixture from "./fixtures/booking-per-unit-cost.json";
import { UPSTREAM_COMMIT } from "./manifest";

describe("upstream oracle fixtures", () => {
  test("parity/booking/per-unit-cost", () => {
    expect(bookingFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(bookingFixture.ledger);

    expect(errors).toEqual([]);
    const entry = entries.find(
      (directive): directive is Transaction => directive instanceof Transaction,
    );
    expect(
      canonicalize(entry?.postings[0].resolvedCost?.amount?.units),
    ).toEqual(bookingFixture.oracle.cost);
    expect(canonicalize(entry?.postings[0].resolvedCost?.date)).toEqual(
      bookingFixture.oracle.date,
    );
  });

  test("parity/prices/last-price-entries", () => {
    expect(pricesFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(pricesFixture.scenario.ledger, {
      transform: false,
    });
    expect(errors).toEqual(pricesFixture.oracle.errors);

    for (const assertion of pricesFixture.oracle.assertions) {
      const actual = getLastPriceEntries(
        entries,
        DateTime.fromISO(assertion.asOf),
      ).map((entry) => ({
        date: entry.date.toISODate(),
        currency: entry.currency,
        units: entry.amount.units.toString(),
        quote: entry.amount.currency,
      }));
      expect(actual).toEqual(assertion.prices);
    }
  });

  test("parity/loader/recursive-relative-includes", () => {
    expect(loaderFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors, options] = loadProjectSources(
      loaderFixture.entryFile,
      loaderFixture.sources,
    );

    expect(errors.map((error) => error.message)).toEqual(
      loaderFixture.expected.errors,
    );
    expect(
      entries
        .filter((entry) => entry.directiveType === "open")
        .map((entry) => entry.accounts[0]),
    ).toEqual(loaderFixture.expected.accounts);
    expect(options.include).toEqual(loaderFixture.expected.includes);
  });
});
