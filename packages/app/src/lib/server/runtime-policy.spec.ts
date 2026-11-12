import { describe, expect, test } from "vitest";
import {
  configForActiveApp,
  registryForActiveApp,
  rulesForActiveApp,
  sourceForActiveApp,
  supportedRuleIds,
} from "./runtime-policy";

const deterministicRule = {
  id: "deterministic",
  name: "Set category",
  resourceType: "transaction" as const,
  active: true,
  effectiveDate: null,
  conditions: [],
  actions: [
    {
      id: "set-category",
      actionType: "set_transaction_category" as const,
      value: "Expenses:Food",
    },
  ],
};

const providerRule = {
  ...deterministicRule,
  id: "provider-backed",
  actions: [
    {
      id: "categorise",
      actionType: "auto_categorise_with_ai" as const,
      value: null,
    },
  ],
};

describe("active application runtime policy", () => {
  test("removes provider settings while retaining deterministic enrichment", () => {
    const source = sourceForActiveApp({
      id: "bank",
      name: "Bank",
      kind: "json-api",
      aiEnabled: true,
      merchantEnrichment: {
        enabled: true,
        aiEnabled: true,
        countryCode: "GB",
      },
      rules: [],
    });

    expect(source).not.toHaveProperty("aiEnabled");
    expect(source.merchantEnrichment).toEqual({
      enabled: true,
      countryCode: "GB",
    });
    expect(
      configForActiveApp({ version: 3, sources: [source] }).sources,
    ).toEqual([source]);
  });

  test("omits provider-backed rules and registry actions", async () => {
    const file = {
      version: 1 as const,
      rules: [deterministicRule, providerRule],
    };
    expect(rulesForActiveApp(file).rules).toEqual([deterministicRule]);
    expect(
      registryForActiveApp({
        filters: [],
        executors: [
          {
            type: "select",
            key: "set_transaction_category",
            label: "Set category",
          },
          {
            type: "function",
            key: "auto_categorise_with_ai",
            label: "Provider action",
          },
        ],
      }).executors.map((executor) => executor.key),
    ).toEqual(["set_transaction_category"]);
    await expect(
      supportedRuleIds("project", undefined, async () => file),
    ).resolves.toEqual(["deterministic"]);
    await expect(
      supportedRuleIds("project", ["provider-backed"], async () => file),
    ).resolves.toEqual([]);
  });
});
