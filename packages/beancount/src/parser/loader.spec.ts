import { describe, test, expect } from "vitest";
import {
  DocumentLoader,
  loadProjectSources,
  loadString,
  resolveProjectInclude,
} from "./loader";
import type { PluginType } from "../ops/plugins";
import { Transaction } from "../core/data";

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

  test("loads sibling includes in declaration order", () => {
    const [entries, errors] = loadProjectSources("main.beancount", {
      "main.beancount": `
        include "a.beancount"
        include "b.beancount"
        2024-01-02 open Assets:Main
      `,
      "a.beancount": "2024-01-01 open Assets:A",
      "b.beancount": "2024-01-01 open Assets:B",
    });

    expect(errors).toEqual([]);
    expect(
      entries
        .filter((entry) => entry.directiveType === "open")
        .map((entry) => entry.accounts[0]),
    ).toEqual(["Assets:A", "Assets:B", "Assets:Main"]);
  });

  test("rejects includes that escape the project root", () => {
    expect(() =>
      resolveProjectInclude("main.beancount", "../outside.beancount"),
    ).toThrow('Project file path escapes its root: "../outside.beancount"');
  });

  test("passes each declared plugin configuration in source order", () => {
    const configurations: Array<string | undefined> = [];
    const plugins: Record<string, PluginType> = {
      "example.plugin": {
        id: "example.plugin",
        order: 0,
        plugin(entries, _options, configuration) {
          configurations.push(configuration);
          return [entries, []];
        },
      },
    };

    const [, errors, options] = loadString(
      `
        plugin "example.plugin" "first"
        plugin "example.plugin" "
          setting: second
        "
      `,
      { dedent: true, plugins },
    );

    expect(errors).toEqual([]);
    expect(options.plugin).toEqual(["example.plugin"]);
    expect(configurations).toHaveLength(2);
    expect(configurations[0]).toBe("first");
    expect(configurations[1]).toContain("setting: second");
  });

  test("uses plugin defaults only when a declaration omits its configuration", () => {
    const configurations: Array<string | undefined> = [];
    const plugins: Record<string, PluginType> = {
      "example.plugin": {
        id: "example.plugin",
        order: 0,
        plugin(entries, _options, configuration) {
          configurations.push(configuration);
          return [entries, []];
        },
      },
    };

    const [, errors] = loadString(
      `
        plugin "example.plugin"
        plugin "example.plugin" "inline: value"
      `,
      {
        dedent: true,
        plugins,
        pluginDefaults: () => ({ "example.plugin": "default: value" }),
      },
    );

    expect(errors).toEqual([]);
    expect(configurations).toEqual(["default: value", "inline: value"]);
  });

  test("reports configuration for built-in plugins that do not support it", () => {
    const [, errors] = loadString(
      'plugin "beancount.plugins.auto" "unexpected"',
    );

    expect(errors.map((error) => error.message)).toContain(
      "Plugin beancount.plugins.auto does not support configuration",
    );
  });

  test("reports global configuration that does not declare a plugin", () => {
    const [, errors] = loadString("", {
      pluginDefaults: () => ({ "example.plugin": "enabled: true" }),
    });

    expect(errors.map((error) => error.message)).toContain(
      "Plugin configuration provided for undeclared plugin example.plugin",
    );
  });

  test("books entries in chronological order before applying transforms", () => {
    const [entries, errors] = loadString(
      `
        option "booking_method" "FIFO"

        2024-01-03 * "Sell"
          Assets:Stock  -1 HOOL {10 USD}
          Assets:Cash   10 USD

        2024-01-01 open Assets:Stock "HOOL"
        2024-01-01 open Assets:Cash "USD"

        2024-01-02 * "Buy"
          Assets:Stock   1 HOOL {10 USD}
          Assets:Cash  -10 USD
      `,
      { dedent: true },
    );
    const bookedSale = entries.find(
      (entry): entry is Transaction =>
        entry instanceof Transaction && entry.narration === "Sell",
    );

    expect(bookedSale?.postings[0].resolvedCost?.date?.toISODate()).toBe(
      "2024-01-02",
    );
    expect(errors).toEqual([]);
  });

  test("reports plugin exceptions as ledger errors and continues loading", () => {
    const plugins: Record<string, PluginType> = {
      "example.throwing": {
        id: "example.throwing",
        order: 0,
        plugin() {
          throw new Error("intentional failure");
        },
      },
    };

    const [, errors] = loadString('plugin "example.throwing"', {
      plugins,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe(
      "Plugin example.throwing failed: intentional failure",
    );
    expect(errors[0].context.plugin).toBe("example.throwing");
  });
});
