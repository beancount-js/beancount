import { describe, test, expect } from "vitest";
import { parseDirectives } from "./parser";

describe("LedgerParser", () => {
  test("parseDirectives", () => {
    const input = `
    2013-05-18 * ""
      Assets:Investments:MSFT      0 MSFT {200.00 USD}
      Assets:Investments:Cash      0 USD
    `;
    const [entries, errors] = parseDirectives(input);
    expect(errors).toEqual([]);
    expect(entries.length).toEqual(1);
    expect(entries[0].toString()).toMatchDirective(`
        2013-05-18 * 
          Assets:Investments:MSFT      0 MSFT { 200.00 USD, 2013-05-18 }
          Assets:Investments:Cash      0 USD
        `);
  });

  test("process includes", () => {
    const input = `
    include "budget.ledger"

    2013-05-18 * ""
      Assets:Investments:MSFT      0 MSFT {200.00 USD}
      Assets:Investments:Cash      0 USD
    `;
    const [entries, errors, options, parser] = parseDirectives(input);
    expect(parser.sources).toEqual(["budget.ledger"]);
    expect(errors).toEqual([]);
    expect(entries.length).toEqual(2);
  });
});
