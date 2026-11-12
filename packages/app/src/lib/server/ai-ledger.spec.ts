import { describe, expect, test } from "vitest";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import { applyLedgerReplacements, ledgerProposal } from "./ai-ledger";

const snapshot: ProjectSnapshot = {
  project: {
    version: 1,
    id: "project",
    name: "Ledger",
    entryFile: "main.bean",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  ledgerFiles: [
    {
      path: "main.bean",
      contents:
        'option "operating_currency" "USD"\n2024-01-01 open Assets:Cash USD\n',
    },
  ],
  resources: [],
  revisions: [
    {
      path: "main.bean",
      revision: "current",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ],
  issues: [],
  envKeys: [],
};

describe("ledger proposal validation", () => {
  test("requires a unique replacement block", () => {
    expect(() =>
      applyLedgerReplacements("USD\nUSD", [{ oldText: "USD", newText: "EUR" }]),
    ).toThrow("occurs more than once");
  });

  test("returns a review-only proposal tied to the source revision", () => {
    const proposal = ledgerProposal(snapshot, {
      path: "main.bean",
      title: "Set reporting currency",
      replacements: [
        {
          oldText: 'option "operating_currency" "USD"',
          newText: 'option "operating_currency" "EUR"',
        },
      ],
    });
    expect(proposal).toMatchObject({
      kind: "ledger",
      title: "Set reporting currency",
      file: { path: "main.bean", revision: "current" },
      valid: true,
    });
  });
});
