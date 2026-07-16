import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "../core/amount";
import { Booking, Posting, Transaction } from "../core/data";
import { Cost, CostSpec, Position } from "../core/position";
import { handleAmbiguousMatches } from "./booking_method";

function transaction() {
  return new Transaction(DateTime.fromISO("2024-01-01"), "*", "", "test");
}

function lot(units: string, cost: string, date: string) {
  return new Position(
    new Amount(units, "HOOL"),
    new Cost(DateTime.fromISO(date), new Amount(cost, "USD")),
  );
}

function reduction(units: string) {
  return new Posting("Assets:Investments", new Amount(units, "HOOL"), null);
}

describe("booking methods", () => {
  test("FIFO splits reductions across oldest lots and preserves each cost", () => {
    const oldest = lot("2", "10", "2020-01-01");
    const newest = lot("3", "20", "2021-01-01");

    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-4"),
      [newest, oldest],
      Booking.FIFO,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([oldest, newest]);
    expect(postings.map((posting) => posting.units?.toString())).toEqual([
      "-2 HOOL",
      "-2 HOOL",
    ]);
    expect(postings.map((posting) => posting.cost)).toEqual([
      oldest.cost,
      newest.cost,
    ]);
  });

  test("LIFO and HIFO choose their respective first lots", () => {
    const oldest = lot("2", "10", "2020-01-01");
    const newest = lot("2", "20", "2021-01-01");

    const [, lifoMatches, lifoErrors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [oldest, newest],
      Booking.LIFO,
    );
    const [, hifoMatches, hifoErrors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [oldest, newest],
      Booking.HIFO,
    );

    expect(lifoErrors).toEqual([]);
    expect(hifoErrors).toEqual([]);
    expect(lifoMatches).toEqual([newest]);
    expect(hifoMatches).toEqual([newest]);
  });

  test("strict-with-size selects the oldest exact-size lot without an ambiguity error", () => {
    const older = lot("3", "10", "2020-01-01");
    const newer = lot("3", "20", "2021-01-01");
    const other = lot("2", "30", "2022-01-01");

    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-3"),
      [newer, other, older],
      Booking.STRICT_WITH_SIZE,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([older]);
    expect(postings).toHaveLength(1);
    expect(postings[0].units?.toString()).toBe("-3 HOOL");
    expect(postings[0].cost).toBe(older.cost);
  });

  test("AVERAGE resolves a weighted cost basis across matching lots", () => {
    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-2"),
      [lot("1", "10", "2020-01-01"), lot("3", "20", "2021-01-01")],
      Booking.AVERAGE,
    );

    expect(errors).toEqual([]);
    expect(matches).toHaveLength(2);
    expect(postings.map((posting) => posting.units?.toString())).toEqual([
      "-1 HOOL",
      "-3 HOOL",
      "4 HOOL",
      "-2 HOOL",
    ]);
    expect(
      postings.map((posting) => posting.resolvedCost?.amount?.toString()),
    ).toEqual(["10 USD", "20 USD", "17.5 USD", "17.5 USD"]);
    expect(postings.map((posting) => posting.flag)).toEqual([
      "M",
      "M",
      "M",
      "",
    ]);
  });

  test("STRICT reports ambiguity unless matching lots exactly satisfy the reduction", () => {
    const first = lot("2", "10", "2020-01-01");
    const second = lot("3", "20", "2021-01-01");

    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-4"),
      [first, second],
      Booking.STRICT,
    );

    expect(postings).toEqual([]);
    expect(matches).toEqual([]);
    expect(errors[0].message).toContain("Ambiguous matches");
  });

  test("STRICT preserves each matched lot when their total exactly satisfies the reduction", () => {
    const first = lot("2", "10", "2020-01-01");
    const second = lot("3", "20", "2021-01-01");

    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-5"),
      [first, second],
      Booking.STRICT,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([]);
    expect(postings.map((posting) => posting.units?.toString())).toEqual([
      "-2 HOOL",
      "-3 HOOL",
    ]);
  });

  test("reports insufficient lots for strict and FIFO reductions", () => {
    const match = lot("1", "10", "2020-01-01");

    for (const method of [Booking.STRICT, Booking.FIFO]) {
      const [postings, matches, errors] = handleAmbiguousMatches(
        transaction(),
        reduction("-2"),
        [match],
        method,
      );

      expect(postings).toHaveLength(1);
      expect(matches).toEqual([match]);
      expect(errors[0].message).toContain("Not enough lots to reduce");
    }
  });

  test("NONE returns an independent costed reduction without selecting a lot", () => {
    const posting = reduction("-1");
    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      posting,
      [lot("1", "10", "2020-01-01")],
      Booking.NONE,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([]);
    expect(postings).toEqual([posting]);
  });

  test("AVERAGE rejects incompatible currencies and explicit reduction costs", () => {
    const entry = transaction();
    const unitCurrencyMismatch = new Position(
      new Amount("1", "AAPL"),
      new Cost(DateTime.fromISO("2021-01-01"), new Amount("20", "USD")),
    );
    const [currencyPostings, currencyMatches, currencyErrors] =
      handleAmbiguousMatches(
        entry,
        reduction("-1"),
        [lot("1", "10", "2020-01-01"), unitCurrencyMismatch],
        Booking.AVERAGE,
      );
    const [costPostings, costMatches, costErrors] = handleAmbiguousMatches(
      entry,
      new Posting(
        "Assets:Investments",
        new Amount("-1", "HOOL"),
        new CostSpec(new Amount("10", "USD").value, null, "USD"),
      ),
      [lot("1", "10", "2020-01-01"), lot("1", "20", "2021-01-01")],
      Booking.AVERAGE,
    );

    expect(currencyPostings).toEqual([]);
    expect(currencyMatches).toEqual([]);
    expect(currencyErrors[0].message).toBe(
      "Cannot merge positions in multiple currencies",
    );
    expect(costPostings).toEqual([]);
    expect(costMatches).toEqual([]);
    expect(costErrors[0].message).toBe(
      "Explicit cost reductions are not supported",
    );
  });

  test("STRICT_WITH_SIZE retains the strict error when no lot has the requested size", () => {
    const [, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-4"),
      [lot("2", "10", "2020-01-01"), lot("3", "20", "2021-01-01")],
      Booking.STRICT_WITH_SIZE,
    );

    expect(matches).toEqual([]);
    expect(errors[0].message).toContain("Ambiguous matches");
  });

  test("FIFO skips mixed-sign lots and stops after satisfying the reduction", () => {
    const skipped = lot("-1", "5", "2019-01-01");
    const selected = lot("2", "10", "2020-01-01");
    const unused = lot("2", "20", "2021-01-01");
    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [skipped, selected, unused],
      Booking.FIFO,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([selected]);
    expect(postings).toHaveLength(1);
    expect(postings[0].resolvedCost).toBe(selected.cost);
  });

  test("AVERAGE delegates one lot to strict and reports impossible reductions", () => {
    const single = lot("2", "10", "2020-01-01");
    const [singlePostings, singleMatches, singleErrors] =
      handleAmbiguousMatches(
        transaction(),
        reduction("-1"),
        [single],
        Booking.AVERAGE,
      );
    const [emptyPostings, emptyMatches, emptyErrors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [],
      Booking.AVERAGE,
    );
    const [missingUnitPostings, missingUnitMatches, missingUnitErrors] =
      handleAmbiguousMatches(
        transaction(),
        new Posting("Assets:Investments"),
        [single],
        Booking.AVERAGE,
      );

    expect(singleErrors).toEqual([]);
    expect(singleMatches).toEqual([single]);
    expect(singlePostings[0].resolvedCost).toBe(single.cost);
    expect(emptyPostings).toEqual([]);
    expect(emptyMatches).toEqual([]);
    expect(emptyErrors[0].message).toContain("Not enough lots to reduce");
    expect(missingUnitPostings).toEqual([]);
    expect(missingUnitMatches).toEqual([]);
    expect(missingUnitErrors[0].message).toContain("Not enough lots to reduce");
  });

  test("falls back to STRICT for an unrecognized booking enum value", () => {
    const match = lot("1", "10", "2020-01-01");
    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [match],
      "UNRECOGNIZED" as Booking,
    );

    expect(errors).toEqual([]);
    expect(matches).toEqual([match]);
    expect(postings[0].resolvedCost).toBe(match.cost);
  });
});
