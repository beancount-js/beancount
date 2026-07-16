import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { getLastPriceEntries } from "../core/prices";
import { Transaction } from "../core/data";
import { loadProjectSources, loadString } from "../parser/loader";
import { formatEntry } from "../parser/printer";
import { canonicalize } from "./canonical";
import loaderFixture from "./fixtures/loader-recursive-relative-includes.json";
import pricesFixture from "./fixtures/prices-last-price-entries.json";
import bookingFixture from "./fixtures/booking-per-unit-cost.json";
import printerFixture from "./fixtures/printer-transaction-weights.json";
import costedPrinterFixture from "./fixtures/printer-costed-transaction.json";
import openPrinterFixture from "./fixtures/printer-open-directive.json";
import pricePrinterFixture from "./fixtures/printer-price-directive.json";
import balancePrinterFixture from "./fixtures/printer-balance-directive.json";
import padPrinterFixture from "./fixtures/printer-pad-directive.json";
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
      loaderFixture.oracle.errors,
    );
    expect(
      entries
        .filter((entry) => entry.directiveType === "open")
        .map((entry) => entry.accounts[0]),
    ).toEqual(loaderFixture.oracle.accounts);
    expect(options.include.map((source) => `<fixture>/${source}`)).toEqual(
      loaderFixture.oracle.includes,
    );
  });

  test("parity/printer/transaction-alignment", () => {
    expect(printerFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(printerFixture.scenario.ledger);
    expect(errors).toEqual(printerFixture.oracle.errors);
    const entry = entries[printerFixture.scenario.entryIndex];
    expect(entry).toBeInstanceOf(Transaction);
    expect(formatEntry(entry as Transaction)).toBe(
      printerFixture.oracle.text.trimEnd(),
    );
  });

  test("parity/printer/costed-transaction-weights", () => {
    expect(costedPrinterFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(costedPrinterFixture.scenario.ledger);
    expect(errors).toEqual(costedPrinterFixture.oracle.errors);
    const entry = entries[costedPrinterFixture.scenario.entryIndex];
    expect(entry).toBeInstanceOf(Transaction);
    expect(formatEntry(entry as Transaction, "", false, true)).toBe(
      costedPrinterFixture.oracle.text.trimEnd(),
    );
  });

  test("parity/printer/open-directive", () => {
    expect(openPrinterFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(openPrinterFixture.scenario.ledger);
    expect(errors).toEqual(openPrinterFixture.oracle.errors);
    expect(formatEntry(entries[openPrinterFixture.scenario.entryIndex])).toBe(
      openPrinterFixture.oracle.text.trimEnd(),
    );
  });

  test("parity/printer/price-directive", () => {
    expect(pricePrinterFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(pricePrinterFixture.scenario.ledger);
    expect(errors).toEqual(pricePrinterFixture.oracle.errors);
    expect(formatEntry(entries[pricePrinterFixture.scenario.entryIndex])).toBe(
      pricePrinterFixture.oracle.text.trimEnd(),
    );
  });

  test("parity/printer/balance-directive", () => {
    expect(balancePrinterFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(balancePrinterFixture.scenario.ledger);
    expect(errors).toEqual(balancePrinterFixture.oracle.errors);
    expect(
      formatEntry(entries[balancePrinterFixture.scenario.entryIndex]),
    ).toBe(balancePrinterFixture.oracle.text.trimEnd());
  });

  test("parity/printer/pad-directive", () => {
    expect(padPrinterFixture.upstream.commit).toBe(UPSTREAM_COMMIT);
    const [entries, errors] = loadString(padPrinterFixture.scenario.ledger);
    expect(errors).toEqual(padPrinterFixture.oracle.errors);
    expect(formatEntry(entries[padPrinterFixture.scenario.entryIndex])).toBe(
      padPrinterFixture.oracle.text.trimEnd(),
    );
  });
});
