import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Close, Commodity, Document, Open, Transaction } from "./data";
import {
  getAccountComponents,
  getAccounts,
  getActiveYears,
  getAllLinks,
  getAllPayees,
  getAllTags,
  getCommodityDirectives,
  getEntryAccounts,
  getMaxDate,
  getMetaValues,
  getMinDate,
  getOpenClose,
} from "./getters";

const firstDate = DateTime.fromISO("2023-12-31");
const secondDate = DateTime.fromISO("2024-01-01");

describe("core getters", () => {
  test("collects account, tag, link, payee, and date information", () => {
    const transaction = new Transaction(
      firstDate,
      "*",
      "Grocer",
      "Shopping",
      ["food"],
      ["receipt"],
      [],
      { source: "bank" },
    );
    const document = new Document(
      secondDate,
      "Assets:Cash",
      "statement.pdf",
      ["statement"],
      ["document"],
      { source: "upload" },
    );
    const entries = [transaction, document];

    expect(getEntryAccounts(document)).toEqual(new Set(["Assets:Cash"]));
    expect(getAccounts(entries)).toEqual(new Set(["Assets:Cash"]));
    expect(getAccountComponents(entries)).toEqual(new Set(["Assets", "Cash"]));
    expect(getAllTags(entries)).toEqual(new Set(["food", "statement"]));
    expect(getAllLinks(entries)).toEqual(new Set(["receipt", "document"]));
    expect(getAllPayees(entries)).toEqual(new Set(["Grocer"]));
    expect(getActiveYears(entries)).toEqual(new Set([2023, 2024]));
    expect(getMinDate(entries)).toEqual(firstDate);
    expect(getMaxDate(entries)).toEqual(secondDate);
    expect(getMetaValues(entries, "source")).toEqual(
      new Set(["bank", "upload"]),
    );
  });

  test("indexes commodities and account open/close records", () => {
    const open = new Open(firstDate, "Assets:Cash");
    const close = new Close(secondDate, "Assets:Cash");
    const commodity = new Commodity(firstDate, "USD", { name: "US Dollar" });
    const entries = [open, close, commodity];

    expect(getCommodityDirectives(entries).get("USD")).toBe(commodity);
    expect(getOpenClose(entries).get("Assets:Cash")).toEqual({
      open,
      close,
    });
  });
});
