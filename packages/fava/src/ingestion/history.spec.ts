import { describe, expect, test } from "vitest";
import { ingestionRunSourceDisplay } from "./history";
import type { IngestionSource } from "./types";

const sources: IngestionSource[] = [
  {
    id: "monzo",
    name: "Monzo",
    kind: "monzo",
    rules: [],
    accounts: [
      {
        id: "acc_primary",
        name: "Personal account",
        sourceAccount: "Assets:Bank:Monzo",
      },
    ],
  },
  {
    id: "credit-card",
    name: "Credit card",
    kind: "json-api",
    rules: [],
    sourceAccount: "Liabilities:Card:Main",
  },
];

describe("ingestion run source display", () => {
  test("uses the linked account name and source account for grouped runs", () => {
    expect(ingestionRunSourceDisplay("monzo:acc_primary", sources)).toEqual({
      title: "Personal account",
      sourceAccount: "Assets:Bank:Monzo",
    });
  });

  test("uses the configured source name for standalone runs", () => {
    expect(ingestionRunSourceDisplay("credit-card", sources)).toEqual({
      title: "Credit card",
      sourceAccount: "Liabilities:Card:Main",
    });
  });

  test("retains the archived source id when configuration no longer has it", () => {
    expect(ingestionRunSourceDisplay("removed:account", sources)).toEqual({
      title: "removed:account",
    });
  });
});
