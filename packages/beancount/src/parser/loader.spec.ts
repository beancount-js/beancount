import { describe, test, expect } from "vitest";
import { DocumentLoader, loadString } from "./loader";

describe("Loader", () => {
  test("loadString", () => {
    const documentLoader: DocumentLoader = (file, _state) => {
      const documents: Record<string, string> = {
        "budget.ledger": `
          include "accounts/accounts.ledger"
    
          1980-05-12 open Equity:Opening-Balances
          1980-05-12 open Liabilities:AccountsPayable
        `,
        "accounts/accounts.ledger": `
          2009-05-01 commodity RGAGX
            export: "MUTF:RGAGX"
            name: "American Funds The Growth Fund of America Class R-6"
            price: "USD:google/MUTF:RGAGX"
        `,
      };
      return documents[file];
    };

    const input = `
    include "budget.ledger"

    2013-05-18 * ""
      Assets:Investments:MSFT      0 MSFT {200.00 USD}
      Assets:Investments:Cash      0 USD
    `;
    const [entries, errors, options] = loadString(input, {
      documentLoader,
      dedent: true,
      logTimings: console.info,
    });

    expect(errors).toEqual([]);
    expect(options.include).toEqual([
      "accounts/accounts.ledger",
      "budget.ledger",
    ]);
    expect(errors).toEqual([]);
    expect(entries.length).toEqual(6);
    expect(entries.map((it) => it.content).join("\n")).toMatchDirective(`
      include "budget.ledger"

      include "accounts/accounts.ledger"
     
      1980-05-12 open Equity:Opening-Balances
     
      1980-05-12 open Liabilities:AccountsPayable
      2009-05-01 commodity RGAGX
        export: "MUTF:RGAGX"
        name: "American Funds The Growth Fund of America Class R-6"
        price: "USD:google/MUTF:RGAGX"
      2013-05-18 * ""
        Assets:Investments:MSFT  0 MSFT {200.00 USD}
        Assets:Investments:Cash  0 USD
    `);
  });
});
