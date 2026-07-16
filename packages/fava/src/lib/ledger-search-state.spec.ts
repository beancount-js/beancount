import { describe, expect, it } from "vitest";
import {
  appendLedgerSearchParams,
  clearLedgerSearchParams,
  facetsToFilterQuery,
  hasActiveLedgerSearchState,
  parseLedgerSearchState,
  quoteFilterToken,
  type LedgerSearchState,
} from "./ledger-search-state";

describe("ledger-search-state", () => {
  it("quotes filter tokens with spaces or metacharacters", () => {
    expect(quoteFilterToken("Assets:Cash")).toBe("Assets:Cash");
    expect(quoteFilterToken("Cafe Nero")).toBe('"Cafe Nero"');
    expect(quoteFilterToken('say "hi"')).toBe('"say \\"hi\\""');
  });

  it("compiles facets into a filter query with OR within facets", () => {
    const state: LedgerSearchState = {
      query: "income",
      sort: "relevance",
      types: ["transaction", "balance"],
      accounts: ["Assets:Cash"],
      payees: ["Cafe Nero"],
      tags: ["travel", "home"],
      years: ["2023", "2024"],
    };
    expect(facetsToFilterQuery(state)).toBe(
      'income (type:transaction OR type:balance) account:Assets:Cash payee:"Cafe Nero" (#travel OR #home) (2023 OR 2024)',
    );
  });

  it("ignores empty facets", () => {
    expect(
      facetsToFilterQuery({
        query: "",
        sort: "relevance",
        types: [],
        accounts: [],
        payees: [],
        tags: [],
        years: [],
      }),
    ).toBe("");
  });

  it("round-trips URL search params including multi facets", () => {
    const state: LedgerSearchState = {
      query: "rent",
      sort: "dateDesc",
      types: ["transaction"],
      accounts: ["Expenses:Rent", "Assets:Cash"],
      payees: [],
      tags: ["home", "rent"],
      years: ["2023"],
    };
    const params = new URLSearchParams({ record: "keep-me", query: "legacy" });
    appendLedgerSearchParams(params, state);
    expect(params.get("query")).toBeNull();
    expect(params.get("record")).toBe("keep-me");
    expect(params.get("searchSort")).toBe("dateDesc");
    expect(params.get("searchType")).toBe("transaction");
    expect(params.get("searchAccounts")).toBe("Expenses:Rent,Assets:Cash");
    expect(params.get("searchTags")).toBe("home,rent");
    expect(params.get("searchYears")).toBe("2023");
    expect(parseLedgerSearchState(params)).toEqual(state);
  });

  it("hydrates legacy singular facet params", () => {
    const params = new URLSearchParams({
      query: "Assets:Cash",
      searchAccount: "Expenses:Food",
      searchPayee: "Acme",
      searchYear: "2022",
      searchTag: "travel",
    });
    expect(parseLedgerSearchState(params)).toMatchObject({
      query: "Assets:Cash",
      accounts: ["Expenses:Food"],
      payees: ["Acme"],
      years: ["2022"],
      tags: ["travel"],
    });
  });

  it("clears search params and reports active state", () => {
    const params = new URLSearchParams({
      searchQ: "x",
      searchType: "open",
      record: "r",
    });
    expect(
      hasActiveLedgerSearchState(parseLedgerSearchState(params)),
    ).toBe(true);
    clearLedgerSearchParams(params);
    expect(params.get("searchQ")).toBeNull();
    expect(params.get("searchType")).toBeNull();
    expect(params.get("record")).toBe("r");
  });
});
