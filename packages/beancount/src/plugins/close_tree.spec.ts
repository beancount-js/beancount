import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Close, Open } from "../core/data";
import { closeTree } from "./close_tree";

const date = (value: string) => DateTime.fromISO(value);

describe("close tree plugin", () => {
  test("closes every opened descendant and retains an opened parent close", () => {
    const [entries, errors] = closeTree([
      new Open(date("2014-01-01"), "Assets:XBank"),
      new Open(date("2014-01-01"), "Assets:XBank:AAPL"),
      new Open(date("2014-01-01"), "Assets:XBank:AAPL:Fuji"),
      new Open(date("2014-01-01"), "Assets:XBank:ORNG"),
      new Close(date("2015-01-01"), "Assets:XBank"),
    ]);

    expect(errors).toEqual([]);
    expect(
      entries
        .filter((entry): entry is Close => entry instanceof Close)
        .map((entry) => entry.account),
    ).toEqual([
      "Assets:XBank:AAPL",
      "Assets:XBank:AAPL:Fuji",
      "Assets:XBank:ORNG",
      "Assets:XBank",
    ]);
  });

  test("does not close an explicitly closed descendant again", () => {
    const [entries] = closeTree([
      new Open(date("2014-01-01"), "Assets:XBank"),
      new Open(date("2014-01-01"), "Assets:XBank:AAPL"),
      new Open(date("2014-01-01"), "Assets:XBank:AAPL:Fuji"),
      new Close(date("2015-01-01"), "Assets:XBank:AAPL:Fuji"),
      new Close(date("2016-01-01"), "Assets:XBank"),
    ]);

    expect(
      entries
        .filter((entry): entry is Close => entry instanceof Close)
        .map((entry) => [entry.date.toISODate(), entry.account]),
    ).toEqual([
      ["2015-01-01", "Assets:XBank:AAPL:Fuji"],
      ["2016-01-01", "Assets:XBank:AAPL"],
      ["2016-01-01", "Assets:XBank"],
    ]);
  });

  test("replaces a close of an unopened parent with descendant closes", () => {
    const [entries] = closeTree([
      new Open(date("2017-11-10"), "Assets:Brokerage:AAPL"),
      new Open(date("2017-11-10"), "Assets:Brokerage:ORNG"),
      new Close(date("2018-11-10"), "Assets:Brokerage"),
    ]);

    expect(
      entries
        .filter((entry): entry is Close => entry instanceof Close)
        .map((entry) => entry.account),
    ).toEqual(["Assets:Brokerage:AAPL", "Assets:Brokerage:ORNG"]);
  });
});
