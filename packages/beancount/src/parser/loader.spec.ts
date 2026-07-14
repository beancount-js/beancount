import { describe, test, expect } from "vitest";
import {
  DocumentLoader,
  loadProjectSources,
  loadString,
  resolveProjectInclude,
} from "./loader";

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
      transform: false,
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

  test("resolves recursive project includes relative to their parent file", () => {
    const [entries, errors, options] = loadProjectSources(
      "ledger/main.beancount",
      {
        "ledger/main.beancount": `
          include "accounts/assets.beancount"
          2024-01-01 open Assets:Cash
        `,
        "ledger/accounts/assets.beancount": `
          include "../commodities.beancount"
          2024-01-01 open Assets:Brokerage
        `,
        "ledger/commodities.beancount": `
          2024-01-01 commodity USD
        `,
      },
      { dedent: true },
    );

    expect(errors).toEqual([]);
    expect(entries).toHaveLength(5);
    expect(options.include).toEqual([
      "ledger/accounts/assets.beancount",
      "ledger/commodities.beancount",
      "ledger/main.beancount",
    ]);
  });

  test("rejects includes that escape the project root", () => {
    expect(() =>
      resolveProjectInclude("main.beancount", "../outside.beancount"),
    ).toThrow('Project file path escapes its root: "../outside.beancount"');
  });
});
