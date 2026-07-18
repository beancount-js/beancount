import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type {
  DetectionRule,
  IngestionRun,
  NormalizedTransaction,
} from "@beancount-js/beangulp";
import { FilesystemIngestionStore } from "./ingestion";
import { applyDetectionRules, previewRuleApply } from "./rules-apply";
import { FilesystemRulesStore } from "./rules";
import { FilesystemWorkspaceAdapter } from "./workspace-adapter";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const transaction: NormalizedTransaction = {
  sourceId: "bank",
  sourceAccount: "Assets:Bank:Current",
  bookedAt: "2026-07-01",
  amount: "-42.00",
  currency: "GBP",
  merchant: "Plata",
  narration: "Plata payment",
  status: "posted",
  fetchedAt: "2026-07-02T00:00:00.000Z",
  metadata: {},
};

const categoryRule: DetectionRule = {
  id: "repayment",
  name: "Plata repayment",
  resourceType: "transaction",
  active: true,
  effectiveDate: null,
  conditions: [
    {
      id: "plata",
      conditionType: "transaction_name",
      operator: "like",
      value: "Plata",
    },
  ],
  actions: [
    {
      id: "set-category",
      actionType: "set_transaction_category",
      value: "Expenses:Debt:Repayment",
    },
  ],
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "beancount-js-rule-apply-"));
  const config = await mkdtemp(join(tmpdir(), "beancount-js-rule-config-"));
  directories.push(root, config);
  await writeFile(
    join(root, "main.beancount"),
    `2026-01-01 open Assets:Bank:Current
2026-01-01 open Expenses:Uncategorized
2026-01-01 open Expenses:Debt:Repayment

2026-07-01 * "Plata" "Plata payment"
  Assets:Bank:Current  -42.00 GBP
  Expenses:Uncategorized  42.00 GBP
`,
  );
  const workspace = new FilesystemWorkspaceAdapter({ configDirectory: config });
  const project = await workspace.openProject(root);
  const resolveProjectRoot = async () => root;
  const ingestionStore = new FilesystemIngestionStore({ resolveProjectRoot });
  const rulesStore = new FilesystemRulesStore({
    resolveProjectRoot,
    ingestionStore,
  });
  await rulesStore.writeRules(project.id, { rules: [categoryRule] });
  const run: IngestionRun = {
    id: "import-run",
    sourceId: "bank",
    startedAt: "2026-07-02T00:00:00.000Z",
    completedAt: "2026-07-02T00:00:01.000Z",
    proposals: [
      {
        id: "proposal-1",
        importId: "bank:1",
        transaction,
        suggestions: [],
        selectedAccount: "Expenses:Uncategorized",
        status: "needs-review",
        issues: [],
      },
    ],
    summary: {
      total: 1,
      ready: 0,
      needsReview: 1,
      accepted: 0,
      duplicates: 0,
      invalid: 0,
      held: 0,
      excluded: 0,
    },
  };
  await ingestionStore.saveRun(project.id, run);
  return { root, project, workspace, ingestionStore, rulesStore };
}

describe("manual rule application targets", () => {
  test("previews only the selected target", async () => {
    const { project, workspace, ingestionStore, rulesStore } = await fixture();

    await expect(
      previewRuleApply({
        projectId: project.id,
        target: "live-ledger",
        workspace,
        ingestionStore,
        rulesStore,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        pendingImports: 0,
        liveLedger: 1,
        total: 1,
      }),
    ]);
    await expect(
      previewRuleApply({
        projectId: project.id,
        target: "pending-imports",
        workspace,
        ingestionStore,
        rulesStore,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        pendingImports: 1,
        liveLedger: 0,
        total: 1,
      }),
    ]);
  });

  test("updates only the live ledger when selected", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture();

    const result = await applyDetectionRules({
      projectId: project.id,
      target: "live-ledger",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(result.results[0]).toMatchObject({
      target: "live-ledger",
      processed: 1,
      modified: 1,
      targetCounts: {
        queued: { pendingImports: 0, liveLedger: 1 },
        modified: { pendingImports: 0, liveLedger: 1 },
      },
    });
    await expect(readFile(join(root, "main.beancount"), "utf8")).resolves.toContain(
      "Expenses:Debt:Repayment 42.00 GBP",
    );
    const [run] = await ingestionStore.readRuns(project.id);
    expect(run?.proposals[0]?.selectedAccount).toBe("Expenses:Uncategorized");
  });

  test("updates only pending imports when selected", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture();

    const result = await applyDetectionRules({
      projectId: project.id,
      target: "pending-imports",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(result.results[0]).toMatchObject({
      target: "pending-imports",
      processed: 1,
      modified: 1,
      targetCounts: {
        queued: { pendingImports: 1, liveLedger: 0 },
        modified: { pendingImports: 1, liveLedger: 0 },
      },
    });
    await expect(readFile(join(root, "main.beancount"), "utf8")).resolves.toContain(
      "Expenses:Uncategorized  42.00 GBP",
    );
    const [run] = await ingestionStore.readRuns(project.id);
    expect(run?.proposals[0]?.selectedAccount).toBe(
      "Expenses:Debt:Repayment",
    );
  });
});
