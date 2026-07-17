import { describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectSources } from "@beancount-js/beancount";
import type { ImportProposal, IngestionRun } from "@beancount-js/beangulp";
import { buildReconciliationReview } from "./reconciliation";
import { FilesystemReconciliationStore } from "./reconciliation";
import { applyReconciliation } from "./reconciliation-apply";
import { FilesystemIngestionStore } from "./ingestion";
import type { IngestionConfig } from "./ingestion";

function proposal(overrides: Partial<ImportProposal> = {}): ImportProposal {
  return {
    id: "proposal-1",
    importId: "bank-1",
    status: "ready",
    selectedAccount: "Expenses:Food",
    suggestions: [],
    issues: [],
    transaction: {
      sourceId: "bank",
      sourceAccount: "Assets:Bank:Checking",
      bookedAt: "2026-07-17",
      amount: "-12.34",
      currency: "GBP",
      narration: "Lunch",
      status: "posted",
      fetchedAt: "2026-07-17T09:00:00.000Z",
      metadata: {},
    },
    ...overrides,
  };
}

function run(
  id: string,
  sourceId: string,
  proposals: readonly ImportProposal[],
): IngestionRun {
  return {
    id,
    sourceId,
    startedAt: "2026-07-17T09:00:00.000Z",
    completedAt: "2026-07-17T09:00:01.000Z",
    proposals,
    summary: {
      total: proposals.length,
      ready: proposals.length,
      needsReview: 0,
      accepted: 0,
      duplicates: 0,
      invalid: 0,
      held: 0,
      excluded: 0,
    },
  };
}

const config: IngestionConfig = {
  version: 3,
  reconciliation: { duplicateWindowDays: 5, transferWindowDays: 4 },
  sources: [
    {
      id: "aggregator",
      name: "Aggregator",
      kind: "json-api",
      sourceAccount: "Assets:Bank:Checking",
      reconciliationPriority: 1,
      api: {
        endpoint: "https://api.example.test/transactions",
        secretRef: "env:TOKEN",
      },
      mapping: { date: "date", amount: "amount" },
      rules: [],
    },
    {
      id: "bank",
      name: "Bank",
      kind: "json-api",
      sourceAccount: "Assets:Bank:Checking",
      reconciliationPriority: 10,
      api: {
        endpoint: "https://bank.example.test/transactions",
        secretRef: "env:TOKEN",
      },
      mapping: { date: "date", amount: "amount" },
      rules: [],
    },
  ],
};

describe("buildReconciliationReview", () => {
  test("uses connection priority for same-account overlap recommendations", () => {
    const review = buildReconciliationReview({
      config,
      runs: [
        run("aggregator-run", "aggregator", [
          proposal({
            importId: "aggregator-1",
            transaction: { ...proposal().transaction!, sourceId: "aggregator" },
          }),
        ]),
        run("bank-run", "bank", [proposal()]),
      ],
      entries: [],
    });
    expect(review.candidates).toMatchObject([
      {
        candidate: {
          kind: "overlap",
          recommendedCanonicalId: "proposal:bank-run:proposal-1",
        },
      },
    ]);
  });

  test("surfaces existing ledger records and keeps them canonical", () => {
    const [entries] = loadProjectSources("main.bean", [
      {
        path: "main.bean",
        contents: `2026-07-17 * "Lunch"\n  Assets:Bank:Checking  -12.34 GBP\n  Expenses:Food\n`,
      },
    ]);
    const review = buildReconciliationReview({
      config,
      runs: [run("bank-run", "bank", [proposal()])],
      entries,
    });
    expect(review.candidates).toMatchObject([
      {
        candidate: {
          kind: "existing",
          recommendedCanonicalId: expect.stringContaining("ledger:main.bean"),
        },
      },
    ]);
  });
});

describe("applyReconciliation", () => {
  test("enriches an existing ledger posting with provenance and accepts the proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-js-reconcile-"));
    try {
      const ingestion = new FilesystemIngestionStore({
        resolveProjectRoot: (project) => join(root, project),
      });
      const decisions = new FilesystemReconciliationStore((project) =>
        join(root, project),
      );
      await ingestion.writeConfig("project", config);
      const pending = run("bank-run", "bank", [proposal()]);
      await ingestion.saveRun("project", pending);

      let contents = `2026-07-17 * "Lunch"\n  Assets:Bank:Checking  -12.34 GBP\n  Expenses:Food\n`;
      let revision = "revision-1";
      const snapshot = () => ({
        project: {
          id: "project",
          name: "Project",
          entryFile: "main.bean",
          version: 1 as const,
          createdAt: "2026-07-17T00:00:00.000Z",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
        ledgerFiles: [{ path: "main.bean", contents }],
        resources: [],
        revisions: [
          {
            path: "main.bean",
            revision,
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        ],
        issues: [],
      });
      const [entries] = loadProjectSources("main.bean", [
        { path: "main.bean", contents },
      ]);
      const initial = buildReconciliationReview({
        config,
        runs: [pending],
        entries,
      });
      const candidate = initial.candidates[0]!.candidate;
      await decisions.save("project", {
        candidateId: candidate.id,
        state: "confirmed",
        canonicalObservationId: candidate.recommendedCanonicalId,
        updatedAt: "2026-07-17T09:00:00.000Z",
      });
      const workspace = {
        projectRoot: async () => join(root, "project"),
        readProject: async () => snapshot(),
        writeFile: async (
          _project: string,
          file: { path: string; contents: string },
          options?: { expectedRevision?: string },
        ) => {
          expect(options?.expectedRevision).toBe(revision);
          contents = file.contents;
          revision = "revision-2";
          return {
            path: file.path,
            revision,
            updatedAt: "2026-07-17T10:00:00.000Z",
          };
        },
      };

      await applyReconciliation({
        projectId: "project",
        candidateId: candidate.id,
        ingestionStore: ingestion,
        reconciliationStore: decisions,
        workspace: workspace as never,
      });

      expect(contents).toContain('import_alt_1_id: "bank-1"');
      await expect(ingestion.run("project", "bank-run")).resolves.toMatchObject(
        {
          proposals: [{ status: "accepted" }],
        },
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes only the selected canonical side of a confirmed cross-source overlap", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "beancount-js-reconcile-overlap-"),
    );
    try {
      const ingestion = new FilesystemIngestionStore({
        resolveProjectRoot: (project) => join(root, project),
      });
      const decisions = new FilesystemReconciliationStore((project) =>
        join(root, project),
      );
      await ingestion.writeConfig("project", config);
      const aggregatorRun = run("aggregator-run", "aggregator", [
        proposal({
          importId: "aggregator-1",
          transaction: { ...proposal().transaction!, sourceId: "aggregator" },
        }),
      ]);
      const bankRun = run("bank-run", "bank", [proposal()]);
      await ingestion.saveRun("project", aggregatorRun);
      await ingestion.saveRun("project", bankRun);

      let contents = `2026-01-01 open Assets:Bank:Checking\n2026-01-01 open Expenses:Food\n`;
      let revision = "revision-1";
      const snapshot = () => ({
        project: {
          id: "project",
          name: "Project",
          entryFile: "main.bean",
          version: 1 as const,
          createdAt: "2026-07-17T00:00:00.000Z",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
        ledgerFiles: [{ path: "main.bean", contents }],
        resources: [],
        revisions: [
          {
            path: "main.bean",
            revision,
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        ],
        issues: [],
      });
      const review = buildReconciliationReview({
        config,
        runs: [aggregatorRun, bankRun],
        entries: [],
      });
      const candidate = review.candidates[0]!.candidate;
      await decisions.save("project", {
        candidateId: candidate.id,
        state: "confirmed",
        canonicalObservationId: candidate.recommendedCanonicalId,
        updatedAt: "2026-07-17T09:00:00.000Z",
      });
      const workspace = {
        projectRoot: async () => join(root, "project"),
        readProject: async () => snapshot(),
        writeFile: async (
          _project: string,
          file: { path: string; contents: string },
        ) => {
          contents = file.contents;
          revision = "revision-2";
          return {
            path: file.path,
            revision,
            updatedAt: "2026-07-17T10:00:00.000Z",
          };
        },
      };

      await applyReconciliation({
        projectId: "project",
        candidateId: candidate.id,
        ingestionStore: ingestion,
        reconciliationStore: decisions,
        workspace: workspace as never,
      });

      expect(contents.match(/2026-07-17 \*/g)).toHaveLength(1);
      expect(contents).toContain('import_id: "bank-1"');
      expect(contents).toContain('import_alt_1_id: "aggregator-1"');
      await expect(ingestion.run("project", "bank-run")).resolves.toMatchObject(
        {
          proposals: [{ status: "accepted" }],
        },
      );
      await expect(
        ingestion.run("project", "aggregator-run"),
      ).resolves.toMatchObject({ proposals: [{ status: "accepted" }] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes a confirmed transfer as one two-posting transaction", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "beancount-js-reconcile-transfer-"),
    );
    try {
      const transferConfig: IngestionConfig = {
        version: 3,
        sources: [
          {
            ...config.sources[0]!,
            id: "checking",
            sourceAccount: "Assets:Bank:Checking",
          },
          {
            ...config.sources[1]!,
            id: "savings",
            sourceAccount: "Assets:Bank:Savings",
          },
        ],
      };
      const ingestion = new FilesystemIngestionStore({
        resolveProjectRoot: (project) => join(root, project),
      });
      const decisions = new FilesystemReconciliationStore((project) =>
        join(root, project),
      );
      await ingestion.writeConfig("project", transferConfig);
      const checkingRun = run("checking-run", "checking", [
        proposal({
          importId: "checking-1",
          selectedAccount: undefined,
          transaction: {
            ...proposal().transaction!,
            sourceId: "checking",
            sourceAccount: "Assets:Bank:Checking",
            narration: "Transfer to savings",
          },
        }),
      ]);
      const savingsRun = run("savings-run", "savings", [
        proposal({
          id: "proposal-2",
          importId: "savings-1",
          selectedAccount: undefined,
          transaction: {
            ...proposal().transaction!,
            sourceId: "savings",
            sourceAccount: "Assets:Bank:Savings",
            amount: "12.34",
            narration: "Transfer from checking",
          },
        }),
      ]);
      await ingestion.saveRun("project", checkingRun);
      await ingestion.saveRun("project", savingsRun);
      let contents = `2026-01-01 open Assets:Bank:Checking\n2026-01-01 open Assets:Bank:Savings\n`;
      let revision = "revision-1";
      const snapshot = () => ({
        project: {
          id: "project",
          name: "Project",
          entryFile: "main.bean",
          version: 1 as const,
          createdAt: "2026-07-17T00:00:00.000Z",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
        ledgerFiles: [{ path: "main.bean", contents }],
        resources: [],
        revisions: [
          {
            path: "main.bean",
            revision,
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        ],
        issues: [],
      });
      const review = buildReconciliationReview({
        config: transferConfig,
        runs: [checkingRun, savingsRun],
        entries: [],
      });
      const candidate = review.candidates.find(
        (item) => item.candidate.kind === "transfer",
      )!.candidate;
      await decisions.save("project", {
        candidateId: candidate.id,
        state: "confirmed",
        canonicalObservationId: "proposal:checking-run:proposal-1",
        updatedAt: "2026-07-17T09:00:00.000Z",
      });
      const workspace = {
        projectRoot: async () => join(root, "project"),
        readProject: async () => snapshot(),
        writeFile: async (
          _project: string,
          file: { path: string; contents: string },
        ) => {
          contents = file.contents;
          revision = "revision-2";
          return {
            path: file.path,
            revision,
            updatedAt: "2026-07-17T10:00:00.000Z",
          };
        },
      };

      await applyReconciliation({
        projectId: "project",
        candidateId: candidate.id,
        ingestionStore: ingestion,
        reconciliationStore: decisions,
        workspace: workspace as never,
      });

      expect(contents).toContain("Assets:Bank:Checking -12.34 GBP");
      expect(contents).toContain("Assets:Bank:Savings 12.34 GBP");
      expect(contents).not.toContain("Expenses:Food");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
