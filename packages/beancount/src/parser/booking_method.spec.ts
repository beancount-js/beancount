import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "../core/amount";
import { Booking, Posting, Transaction } from "../core/data";
import { Cost, Position } from "../core/position";
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

  test("reports the unsupported AVERAGE mode instead of falling back to strict", () => {
    const [postings, matches, errors] = handleAmbiguousMatches(
      transaction(),
      reduction("-1"),
      [lot("1", "10", "2020-01-01"), lot("1", "20", "2021-01-01")],
      Booking.AVERAGE,
    );

    expect(postings).toEqual([]);
    expect(matches).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      "AVERAGE method is not supported",
    ]);
  });
});
