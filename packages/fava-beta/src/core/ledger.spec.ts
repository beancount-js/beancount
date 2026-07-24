import { describe, expect, test } from "vitest";
import type { PluginType } from "@beancount-js/beancount";
import { parse } from "yaml";
import { LedgerSource } from "./ledger";

function loadWithPlugin(
  contents: string,
  configurations: Array<string | undefined>,
) {
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
  return new LedgerSource(contents, { plugins });
}

describe("LedgerSource plugin defaults", () => {
  test("seeds a declared plugin from the global ledger option", () => {
    const configurations: Array<string | undefined> = [];
    const source = loadWithPlugin(
      `
        2024-01-01 custom "ledger-option" "plugins" "
          example.plugin:
            mode: global
        "
        plugin "example.plugin"
      `,
      configurations,
    );

    expect(source.errors).toEqual([]);
    expect(configurations).toHaveLength(1);
    expect(parse(configurations[0]!)).toEqual({ mode: "global" });
  });

  test("prefers a plugin declaration's inline configuration", () => {
    const configurations: Array<string | undefined> = [];
    const source = loadWithPlugin(
      `
        2024-01-01 custom "ledger-option" "plugins" "
          example.plugin:
            mode: global
        "
        plugin "example.plugin" "mode: inline"
      `,
      configurations,
    );

    expect(source.errors).toEqual([]);
    expect(configurations).toEqual(["mode: inline"]);
  });

  test("applies global forecast dates to a bare forecast declaration", () => {
    const source = new LedgerSource(
      `
      2024-01-01 custom "ledger-option" "plugins" "
        beancount.plugins.forecast:
          now: 2024-01-10
          end: 2024-02-10
      "
      plugin "beancount.plugins.forecast"

      2024-01-01 open Expenses:Subscriptions GBP
      2024-01-01 open Assets:Checking GBP

      2024-01-01 # "Subscription [MONTHLY]"
        Expenses:Subscriptions  10 GBP
        Assets:Checking        -10 GBP
    `,
      { logTimings: undefined },
    );

    expect(source.errors).toEqual([]);
    expect(source.transactions.map((entry) => entry.date.toISODate())).toEqual([
      "2024-01-01",
      "2024-02-01",
    ]);
  });

  test("does not enable a plugin from global configuration alone", () => {
    const configurations: Array<string | undefined> = [];
    const source = loadWithPlugin(
      `
        2024-01-01 custom "ledger-option" "plugins" "
          example.plugin:
            mode: global
        "
      `,
      configurations,
    );

    expect(configurations).toEqual([]);
    expect(source.errors.map((error) => error.message)).toContain(
      "Plugin configuration provided for undeclared plugin example.plugin",
    );
  });
});
