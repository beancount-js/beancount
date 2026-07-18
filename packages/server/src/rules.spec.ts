import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { FilesystemIngestionStore, type IngestionConfig } from "./ingestion";
import { FilesystemRulesStore } from "./rules";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("FilesystemRulesStore", () => {
  test("persists rules and migrates legacy source merchant rules", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beancount-js-rules-"));
    directories.push(directory);
    const resolveProjectRoot = async (project: string) =>
      join(directory, project);
    const ingestion = new FilesystemIngestionStore({ resolveProjectRoot });
    const rules = new FilesystemRulesStore({
      resolveProjectRoot,
      ingestionStore: ingestion,
    });

    const config: IngestionConfig = {
      version: 2,
      sources: [
        {
          id: "bank",
          name: "Bank",
          kind: "json-api",
          sourceAccount: "Assets:Bank:Checking",
          api: {
            endpoint: "https://api.example.test/transactions",
            allowedHosts: ["api.example.test"],
            secretRef: "env:BANK_API_TOKEN",
          },
          mapping: { date: "date", amount: "amount" },
          rules: [
            {
              merchant: "Plata",
              account: "Expenses:Debt:Repayment",
            },
          ],
        },
      ],
    };
    await ingestion.writeConfig("project", config);

    const migrated = await rules.readRules("project");
    expect(migrated.rules).toHaveLength(1);
    expect(migrated.rules[0].name).toBe("Plata");
    expect(migrated.rules[0].actions[0].value).toBe("Expenses:Debt:Repayment");

    const sources = await readFile(
      join(directory, "project", ".beancount", "ingestion", "sources.json"),
      "utf8",
    );
    expect(JSON.parse(sources).sources[0].rules).toEqual([]);

    const run = await rules.startRun("project", {
      ruleId: migrated.rules[0].id,
      ruleName: "Plata",
      queued: 3,
      target: "live-ledger",
      targetCounts: {
        queued: { pendingImports: 0, liveLedger: 3 },
        processed: { pendingImports: 0, liveLedger: 0 },
        modified: { pendingImports: 0, liveLedger: 0 },
      },
    });
    expect(run.status).toBe("pending");
    expect(run).toMatchObject({
      target: "live-ledger",
      targetCounts: {
        queued: { pendingImports: 0, liveLedger: 3 },
      },
    });
    const completed = await rules.completeRun("project", run.id, {
      status: "success",
      processed: 3,
      modified: 1,
    });
    expect(completed).toMatchObject({
      status: "success",
      transactionsProcessed: 3,
      transactionsModified: 1,
      transactionsBlocked: 2,
    });
    const listed = await rules.listRuns("project", { limit: 10, offset: 0 });
    expect(listed.total).toBe(1);
    expect(listed.runs[0].id).toBe(run.id);
  });
});
