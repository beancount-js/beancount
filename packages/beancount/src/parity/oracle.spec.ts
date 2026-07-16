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
    expect(entry?.postings[0].resolvedCost?.amount?.toString()).toBe(
      bookingFixture.expected.cost,
    );
    expect(entry?.postings[0].resolvedCost?.date?.toISODate()).toBe(
      bookingFixture.expected.date,
    );
  });

  test("parity/prices/last-price-entries", () => {
    expect(pricesFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(pricesFixture.ledger, {
      transform: false,
    });
    expect(errors).toEqual([]);

    for (const assertion of pricesFixture.assertions) {
      const actual = getLastPriceEntries(
        entries,
        DateTime.fromISO(assertion.asOf),
      ).map((entry) => ({
        date: entry.date,
        currency: entry.currency,
        units: entry.amount.units,
        quote: entry.amount.currency,
      }));
      expect(canonicalize(actual)).toEqual(
        assertion.prices.map((price) => ({
          date: { $date: price.date },
          currency: price.currency,
          units: { $decimal: price.units },
          quote: price.quote,
        })),
      );
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
