import { describe, expect, test } from "vitest";
import { starlingConnector, validateStarlingConfig } from "./connector";

describe("starling connector", () => {
  test("validates production and sandbox configurations", () => {
    expect(
      validateStarlingConfig({
        secretRef: "env:STARLING_ACCESS_TOKEN",
        baseUrl: "https://api-sandbox.starlingbank.com/",
        lookbackDays: 14,
      }),
    ).toEqual({
      secretRef: "env:STARLING_ACCESS_TOKEN",
      baseUrl: "https://api-sandbox.starlingbank.com",
      allowedHosts: ["api.starlingbank.com", "api-sandbox.starlingbank.com"],
      syncStartDate: undefined,
      lookbackDays: 14,
    });
    expect(() =>
      validateStarlingConfig({
        secretRef: "token",
        baseUrl: "https://example.com",
      }),
    ).toThrow("allowlist");
  });

  test("expands linked accounts independently", () => {
    expect(
      starlingConnector.expandTargets({
        id: "starling",
        name: "Starling Bank",
        kind: "starling",
        config: starlingConnector.defaultConfig(),
        rules: [],
        accounts: [
          {
            id: "account-1",
            name: "Personal",
            sourceAccount: "Assets:Bank:Starling",
            defaultCurrency: "GBP",
          },
        ],
      }),
    ).toEqual([
      {
        sourceId: "starling:account-1",
        sourceAccount: "Assets:Bank:Starling",
        defaultCurrency: "GBP",
        accountId: "account-1",
      },
    ]);
  });
});
