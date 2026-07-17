import { describe, expect, test } from "vitest";
import { monzoConnector, validateMonzoConfig } from "./connector";

describe("monzo connector", () => {
  test("validates production and local configurations", () => {
    expect(
      validateMonzoConfig({
        secretRef: "env:MONZO_ACCESS_TOKEN",
        baseUrl: "https://api.monzo.com/",
        lookbackDays: 14,
      }),
    ).toEqual({
      secretRef: "env:MONZO_ACCESS_TOKEN",
      baseUrl: "https://api.monzo.com",
      allowedHosts: ["api.monzo.com"],
      syncStartDate: undefined,
      lookbackDays: 14,
    });
    expect(() =>
      validateMonzoConfig({
        secretRef: "token",
        baseUrl: "https://example.com",
      }),
    ).toThrow("allowlist");
    expect(() =>
      validateMonzoConfig({
        secretRef: "token",
        baseUrl: "https://api.monzo.com",
        lookbackDays: 91,
      }),
    ).toThrow("0 to 90");
  });

  test("provides the manual-token defaults", () => {
    expect(monzoConnector.defaultConfig()).toEqual({
      secretRef: "env:MONZO_ACCESS_TOKEN",
      baseUrl: "https://api.monzo.com",
      allowedHosts: ["api.monzo.com"],
      lookbackDays: 30,
    });
  });

  test("expands linked accounts independently", () => {
    expect(
      monzoConnector.expandTargets({
        id: "monzo",
        name: "Monzo Bank",
        kind: "monzo",
        config: monzoConnector.defaultConfig(),
        rules: [],
        accounts: [
          {
            id: "account-1",
            name: "Personal",
            sourceAccount: "Assets:Bank:Monzo",
            defaultCurrency: "GBP",
          },
        ],
      }),
    ).toEqual([
      {
        sourceId: "monzo:account-1",
        sourceAccount: "Assets:Bank:Monzo",
        defaultCurrency: "GBP",
        accountId: "account-1",
      },
    ]);
  });
});
