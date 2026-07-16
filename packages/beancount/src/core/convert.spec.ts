import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import {
  convertAmount,
  convertPosition,
  getCost,
  getUnits,
  getValue,
  getWeight,
} from "./convert";
import { Posting, Price } from "./data";
import { Position, Cost } from "./position";
import { PriceMap } from "./prices";

const date = DateTime.fromISO("2024-01-10");
const prices = new PriceMap([
  new Price(date, "HOOL", new Amount("10", "USD")),
  new Price(date, "USD", new Amount("0.8", "EUR")),
]);

describe("position conversion", () => {
  test("derives units, cost, and weight with the correct precedence", () => {
    const costed = new Position(
      new Amount("2", "HOOL"),
      new Cost(date, new Amount("7", "USD")),
    );
    const priced = new Posting(
      "Assets:Brokerage",
      new Amount("2", "HOOL"),
      null,
      new Amount("8", "USD"),
    );

    expect(getUnits(costed)).toEqual(new Amount("2", "HOOL"));
    expect(getCost(costed)).toEqual(new Amount("14", "USD"));
    expect(getWeight(costed)).toEqual(new Amount("14", "USD"));
    expect(getWeight(priced)).toEqual(new Amount("16", "USD"));
  });

  test("uses the cost or posting price currency to obtain market value", () => {
    const position = new Position(
      new Amount("2", "HOOL"),
      new Cost(date, new Amount("7", "USD")),
    );
    const observed: Array<[DateTime | null, unknown?]> = [];

    expect(getValue(position, prices, date, observed)).toEqual(
      new Amount("20", "USD"),
    );
    expect(observed).toEqual([[date, expect.anything()]]);
    expect(
      getValue(new Position(new Amount("2", "HOOL")), prices, date),
    ).toEqual(new Amount("2", "HOOL"));
  });

  test("converts directly, through cost currency, or leaves amounts unchanged", () => {
    const position = new Position(
      new Amount("2", "HOOL"),
      new Cost(date, new Amount("7", "USD")),
    );

    expect(convertAmount(new Amount("2", "HOOL"), "USD", prices, date)).toEqual(
      new Amount("20", "USD"),
    );
    expect(convertPosition(position, "EUR", prices, date)).toEqual(
      new Amount("16", "EUR"),
    );
    expect(convertAmount(new Amount("2", "HOOL"), "CAD", prices, date)).toEqual(
      new Amount("2", "HOOL"),
    );
  });
});
