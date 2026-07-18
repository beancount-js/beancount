import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  DetectionRule,
  IngestionRun,
  NormalizedTransaction,
} from "@beancount-js/beangulp";
import { FilesystemIngestionStore } from "./ingestion";
import {
  applyDetectionRules,
  previewRuleApply,
  type RuleAiBatchInput,
} from "./rules-apply";
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

const renameRule: DetectionRule = {
  id: "rename-plata",
  name: "Rename Plata",
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
      id: "set-name",
      actionType: "set_transaction_name",
      value: "Debt repayment",
    },
  ],
};

const renamedCategoryRule: DetectionRule = {
  ...categoryRule,
  id: "categorise-renamed-plata",
  name: "Categorise renamed Plata",
  conditions: [
    {
      id: "renamed-plata",
      conditionType: "transaction_name",
      operator: "=",
      value: "Debt repayment",
    },
  ],
};

const foodCategoryRule: DetectionRule = {
  ...categoryRule,
  id: "categorise-plata-as-food",
  name: "Categorise Plata as food",
  actions: [
    {
      id: "set-category",
      actionType: "set_transaction_category",
      value: "Expenses:Food",
    },
  ],
};

const aiEnrichmentRule: DetectionRule = {
  id: "enrich-plata-with-ai",
  name: "Enrich Plata with AI",
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
      id: "categorise-with-ai",
      actionType: "auto_categorise_with_ai",
      value: null,
    },
    {
      id: "detect-merchant-with-ai",
      actionType: "auto_detect_merchant_with_ai",
      value: null,
    },
  ],
};

async function fixture(rules: DetectionRule[] = [categoryRule]) {
  const root = await mkdtemp(join(tmpdir(), "beancount-js-rule-apply-"));
  const config = await mkdtemp(join(tmpdir(), "beancount-js-rule-config-"));
  directories.push(root, config);
  await writeFile(
    join(root, "main.beancount"),
    `2026-01-01 open Assets:Bank:Current
2026-01-01 open Expenses:Uncategorized
2026-01-01 open Expenses:Debt:Repayment
2026-01-01 open Expenses:Food

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
  await rulesStore.writeRules(project.id, { rules });
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
    ).resolves.toMatchObject({
      preview: [
        {
          pendingImports: 0,
          liveLedger: 1,
          total: 1,
        },
      ],
      summary: {
        unique: { pendingImports: 0, liveLedger: 1 },
      },
    });
    await expect(
      previewRuleApply({
        projectId: project.id,
        target: "pending-imports",
        workspace,
        ingestionStore,
        rulesStore,
      }),
    ).resolves.toMatchObject({
      preview: [
        {
          pendingImports: 1,
          liveLedger: 0,
          total: 1,
        },
      ],
      summary: {
        unique: { pendingImports: 1, liveLedger: 0 },
      },
    });
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
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Debt:Repayment 42.00 GBP");
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
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Uncategorized  42.00 GBP");
    const [run] = await ingestionStore.readRuns(project.id);
    expect(run?.proposals[0]?.selectedAccount).toBe("Expenses:Debt:Repayment");
  });

  test("updates both targets only when explicitly selected", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture();

    const result = await applyDetectionRules({
      projectId: project.id,
      target: "both",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(result.results[0]).toMatchObject({
      target: "both",
      processed: 2,
      modified: 2,
      targetCounts: {
        queued: { pendingImports: 1, liveLedger: 1 },
        modified: { pendingImports: 1, liveLedger: 1 },
      },
    });
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Debt:Repayment 42.00 GBP");
    const [run] = await ingestionStore.readRuns(project.id);
    expect(run?.proposals[0]?.selectedAccount).toBe("Expenses:Debt:Repayment");
  });

  test("plans overlapping rules once while preserving stored rule order", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture([renameRule, renamedCategoryRule]);
    const preview = await previewRuleApply({
      projectId: project.id,
      target: "live-ledger",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(preview).toMatchObject({
      preview: [
        { ruleId: renameRule.id, liveLedger: 1 },
        { ruleId: renamedCategoryRule.id, liveLedger: 1 },
      ],
      summary: {
        matched: { pendingImports: 0, liveLedger: 2 },
        unique: { pendingImports: 0, liveLedger: 1 },
        overlaps: { pendingImports: 0, liveLedger: 1 },
        conflicts: { pendingImports: 0, liveLedger: 0 },
      },
    });

    const writeFile = vi.spyOn(workspace, "writeFile");
    const result = await applyDetectionRules({
      projectId: project.id,
      target: "live-ledger",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(result.summary).toMatchObject({
      unique: { pendingImports: 0, liveLedger: 1 },
      overlaps: { pendingImports: 0, liveLedger: 1 },
    });
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain('"Plata" "Debt repayment"');
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Debt:Repayment 42.00 GBP");
  });

  test("reports conflicting field writes and lets the later stored rule win", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture([categoryRule, foodCategoryRule]);

    const result = await applyDetectionRules({
      projectId: project.id,
      target: "live-ledger",
      workspace,
      ingestionStore,
      rulesStore,
    });

    expect(result.summary).toMatchObject({
      matched: { pendingImports: 0, liveLedger: 2 },
      unique: { pendingImports: 0, liveLedger: 1 },
      overlaps: { pendingImports: 0, liveLedger: 1 },
      conflicts: { pendingImports: 0, liveLedger: 1 },
    });
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Food 42.00 GBP");
  });

  test("stages matching AI actions into target-wide batches", async () => {
    const { root, project, workspace, ingestionStore, rulesStore } =
      await fixture([aiEnrichmentRule]);
    const categorise = vi.fn(async (inputs: readonly RuleAiBatchInput[]) =>
      inputs.map((input) => ({
        id: input.id,
        selectedAccount: "Expenses:Food",
      })),
    );
    const detectMerchants = vi.fn(async (inputs: readonly RuleAiBatchInput[]) =>
      inputs.map((input) => ({ id: input.id, merchant: "Plata Card" })),
    );

    const preview = await previewRuleApply({
      projectId: project.id,
      target: "both",
      workspace,
      ingestionStore,
      rulesStore,
    });
    expect(preview.summary).toMatchObject({
      unique: { pendingImports: 1, liveLedger: 1 },
      modified: { pendingImports: 0, liveLedger: 0 },
    });
    expect(categorise).not.toHaveBeenCalled();
    expect(detectMerchants).not.toHaveBeenCalled();

    const result = await applyDetectionRules({
      projectId: project.id,
      target: "both",
      workspace,
      ingestionStore,
      rulesStore,
      ai: { categorise, detectMerchants },
    });

    expect(categorise).toHaveBeenCalledTimes(1);
    expect(detectMerchants).toHaveBeenCalledTimes(1);
    expect(categorise.mock.calls[0]?.[0]).toHaveLength(2);
    expect(detectMerchants.mock.calls[0]?.[0]).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      targetCounts: {
        modified: { pendingImports: 1, liveLedger: 1 },
      },
    });
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain('"Plata Card" "Plata payment"');
    await expect(
      readFile(join(root, "main.beancount"), "utf8"),
    ).resolves.toContain("Expenses:Food 42.00 GBP");
    const [run] = await ingestionStore.readRuns(project.id);
    expect(run?.proposals[0]).toMatchObject({
      selectedAccount: "Expenses:Food",
      transaction: { merchant: "Plata Card" },
    });
  });
});
