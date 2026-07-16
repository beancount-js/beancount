import { describe, test, expect } from "vitest";
import {
  DocumentLoader,
  type DocumentStore,
  LoadError,
  loadBeancountOptions,
  loadDocumentStore,
  loadProjectSources,
  loadString,
  normalizeProjectPath,
  parseRecursive,
  resolveProjectInclude,
  runTransformations,
} from "./loader";
import type { PluginType } from "../ops/plugins";
import { defaultBeancountOptions } from "../core/options";
import { Plugin, Transaction } from "../core/data";

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

  test("loads ledgers from a bounded document store without filesystem access", () => {
    const documents = new Map([
      [
        "ledger/main.beancount",
        'include "accounts.beancount"\n2024-01-01 open Assets:Cash',
      ],
      ["ledger/accounts.beancount", "2024-01-01 open Equity:Opening"],
      ["ledger/2024-01-01-statement.pdf", undefined],
    ]);
    const store: DocumentStore = {
      list() {
        return [...documents].map(([path, contents]) => ({ path, contents }));
      },
      exists(path) {
        return documents.has(path);
      },
    };

    const [entries, errors] = loadDocumentStore("ledger/main.beancount", store);

    expect(errors).toEqual([]);
    expect(
      entries
        .filter((entry) => entry.directiveType === "open")
        .map((entry) => entry.accounts[0]),
    ).toEqual(["Equity:Opening", "Assets:Cash"]);
  });

  test("rejects includes that escape the project root", () => {
    expect(() =>
      resolveProjectInclude("main.beancount", "../outside.beancount"),
    ).toThrow('Project file path escapes its root: "../outside.beancount"');
  });

  test("normalizes bounded project paths and rejects unusable paths", () => {
    expect(normalizeProjectPath("ledger\\accounts/../main.beancount")).toBe(
      "ledger/main.beancount",
    );
    expect(() => normalizeProjectPath("")).toThrow(
      'Project file path must be relative: ""',
    );
    expect(() => normalizeProjectPath("/outside.beancount")).toThrow(
      'Project file path must be relative: "/outside.beancount"',
    );
    expect(() => normalizeProjectPath(".")).toThrow(
      'Project file path must name a file: "."',
    );
  });

  test("reports unavailable and duplicate include sources without filesystem access", () => {
    const [, missingLoaderErrors] = loadString('include "missing.beancount"', {
      transform: false,
    });
    const [, missingFileErrors] = loadString('include "missing.beancount"', {
      transform: false,
      documentLoader: () => undefined,
    });
    const [, cycleErrors] = loadProjectSources("main.beancount", {
      "main.beancount": 'include "loop.beancount"',
      "loop.beancount": 'include "main.beancount"',
    });

    expect(missingLoaderErrors[0].message).toBe(
      'No document loader for file: "missing.beancount"',
    );
    expect(missingFileErrors[0].message).toBe(
      'Failed to load include file: "missing.beancount"',
    );
    expect(cycleErrors[0].message).toBe(
      'Duplicate filename parsed: "main.beancount"',
    );
  });

  test("rejects duplicate bounded sources and records include resolver failures", () => {
    expect(() =>
      loadProjectSources("main.beancount", [
        { path: "main.beancount", contents: "" },
        { path: "./main.beancount", contents: "" },
      ]),
    ).toThrow('Duplicate project source: "main.beancount"');

    const [, errors] = loadString('include "missing.beancount"', {
      includeResolver: () => {
        throw new Error("resolver failure");
      },
      transform: false,
    });

    expect(errors[0].message).toBe(
      'Failed to resolve include "missing.beancount"',
    );
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

  test("limits raw mode to declared plugins while default mode runs post plugins", () => {
    const calls: string[] = [];
    const plugins: Record<string, PluginType> = {
      "example.plugin": {
        id: "example.plugin",
        order: 0,
        plugin(entries) {
          calls.push("declared");
          return [entries, []];
        },
      },
      "beancount.ops.pad": {
        id: "beancount.ops.pad",
        order: 10,
        plugin(entries) {
          calls.push("pad");
          return [entries, []];
        },
      },
      "beancount.ops.balance": {
        id: "beancount.ops.balance",
        order: 0,
        plugin(entries) {
          calls.push("balance");
          return [entries, []];
        },
      },
    };

    const source = 'plugin "example.plugin"';
    const [, rawErrors] = loadString(
      `option "plugin_processing_mode" "raw"\n${source}`,
      { plugins },
    );
    expect(rawErrors).toEqual([]);
    expect(calls).toEqual(["declared"]);

    calls.length = 0;
    const [, defaultErrors] = loadString(source, { plugins });
    expect(defaultErrors).toEqual([]);
    expect(calls).toEqual(["declared", "pad", "balance"]);
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

  test("normalizes relative include paths and supports direct string parsing", () => {
    const files: Record<string, string> = {
      ".": "2024-01-01 open Assets:Dot",
      "shared.beancount": "2024-01-01 open Assets:Shared",
    };
    const [entries, errors] = loadString(
      'include "."\ninclude "nested/../shared.beancount"',
      { documentLoader: (filename) => files[filename], transform: false },
    );

    expect(errors).toEqual([]);
    expect(
      entries
        .filter((entry) => entry.directiveType === "open")
        .map((entry) => entry.accounts[0]),
    ).toEqual(["Assets:Dot", "Assets:Shared"]);
    expect(
      parseRecursive("2024-01-01 open Assets:Direct", {
        transform: false,
        plugins: {},
        dedent: false,
      })[0],
    ).toHaveLength(1);
  });

  test("bounds document stores and reports option schema failures without directives", () => {
    const duplicateStore: DocumentStore = {
      list: () => [
        { path: "main.beancount", contents: "" },
        { path: "./main.beancount", contents: "" },
      ],
      exists: () => true,
    };
    expect(() => loadDocumentStore("main.beancount", duplicateStore)).toThrow(
      'Duplicate project source: "main.beancount"',
    );

    const missingStore: DocumentStore = {
      list: () => [
        {
          path: "main.beancount",
          contents: 'include "missing.beancount"',
        },
      ],
      exists: (path) => path === "main.beancount",
    };
    expect(
      loadDocumentStore("main.beancount", missingStore, {
        transform: false,
      })[1][0].message,
    ).toBe('Failed to load include file: "missing.beancount"');

    const [, optionErrors] = loadBeancountOptions(
      [[], [], { include: "child.beancount", unknown_option: "value" }],
      { transform: false, plugins: {}, dedent: false },
    );
    expect(optionErrors[0].context.lineno).toBe(0);
    expect(optionErrors[0].message).toContain("unknown_option");
  });

  test("reports unsupported plugins and attributes returned or non-Error failures", () => {
    const reported = new LoadError("reported plugin error");
    const configurations: string[] = [];
    const plugins: Record<string, PluginType> = {
      "example.string": {
        id: "example.string",
        order: 0,
        plugin(entries, _options, configuration) {
          configurations.push(configuration ?? "");
          return [entries, [reported]];
        },
      },
      "example.non-error": {
        id: "example.non-error",
        order: 0,
        plugin() {
          throw "string failure";
        },
      },
    };

    const [, unsupportedErrors] = loadString('plugin "example.unknown"', {
      plugins,
    });
    expect(unsupportedErrors[0].message).toBe(
      "Unsupported plugin example.unknown",
    );

    const [, errors] = runTransformations(
      [
        [
          new Plugin("example.string", "inline: value"),
          new Plugin("example.non-error"),
        ],
        [],
        defaultBeancountOptions({ plugin_processing_mode: "raw" }),
      ],
      { transform: true, plugins, dedent: false },
    );

    expect(configurations).toEqual(["inline: value"]);
    expect(reported.context.plugin).toBe("example.string");
    expect(errors.map((error) => error.message)).toEqual([
      "reported plugin error",
      "Plugin example.non-error failed: string failure",
    ]);
  });
});
