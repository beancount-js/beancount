import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import {
  createRuleRegistry,
  emptyRuleRunsFile,
  emptyRulesFile,
  migrateMerchantRules,
  parseDetectionRule,
  parseRuleRunsFile,
  parseRulesFile,
  ruleBlockedCount,
  validateDetectionRule,
  type DetectionRule,
  type MerchantRule,
  type RuleRun,
  type RuleRunsFile,
  type RulesFile,
} from "@beancount-js/beangulp";
import { projectRuleRunsPath, projectRulesPath } from "./paths";
import type { FilesystemIngestionStore } from "./ingestion";

const RULE_RUNS_CAP = 500;

export type ProjectRootResolver = (projectId: string) => Promise<string>;

export type FilesystemRulesStoreOptions = {
  resolveProjectRoot: ProjectRootResolver;
  /** Used to migrate legacy per-source merchant rules into the global store. */
  ingestionStore?: FilesystemIngestionStore;
};

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function projectId(project: string) {
  return project;
}

export class FilesystemRulesStore {
  private readonly resolveProjectRoot: ProjectRootResolver;
  private readonly ingestionStore?: FilesystemIngestionStore;
  private migrating = new Set<string>();

  constructor(options: FilesystemRulesStoreOptions) {
    this.resolveProjectRoot = options.resolveProjectRoot;
    this.ingestionStore = options.ingestionStore;
  }

  async projectRoot(project: string) {
    return this.resolveProjectRoot(projectId(project));
  }

  private async write(path: string, value: unknown) {
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, path);
  }

  async readRules(project: string): Promise<RulesFile> {
    const root = await this.projectRoot(project);
    const path = projectRulesPath(root);
    const raw = await readJson(path, emptyRulesFile());
    let file = parseRulesFile(raw);
    if (file.rules.length === 0) {
      file = await this.migrateFromSourcesIfNeeded(project, file);
    }
    return file;
  }

  async listActive(project: string): Promise<DetectionRule[]> {
    const file = await this.readRules(project);
    return file.rules.filter((rule) => rule.active);
  }

  async writeRules(project: string, file: RulesFile | { rules: DetectionRule[] }) {
    const rules = (file.rules ?? [])
      .map((rule) => parseDetectionRule(rule) ?? rule)
      .filter((rule): rule is DetectionRule => Boolean(rule));
    for (const rule of rules) {
      const errors = validateDetectionRule(rule);
      if (errors.length > 0) {
        throw new Error(
          `Invalid rule${rule.name ? ` "${rule.name}"` : ""}: ${errors.join(" ")}`,
        );
      }
    }
    if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
      throw new Error("Rule identifiers must be unique.");
    }
    const root = await this.projectRoot(project);
    await this.write(projectRulesPath(root), {
      version: 1,
      rules,
    } satisfies RulesFile);
  }

  async readRuns(project: string): Promise<RuleRunsFile> {
    const root = await this.projectRoot(project);
    return parseRuleRunsFile(
      await readJson(projectRuleRunsPath(root), emptyRuleRunsFile()),
    );
  }

  async listRuns(
    project: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const file = await this.readRuns(project);
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(100, Math.max(1, options.limit ?? 10));
    const runs = file.runs.slice(offset, offset + limit);
    return {
      runs,
      total: file.runs.length,
      offset,
      limit,
    };
  }

  async appendRun(project: string, run: RuleRun) {
    const file = await this.readRuns(project);
    const next: RuleRunsFile = {
      version: 1,
      runs: [run, ...file.runs].slice(0, RULE_RUNS_CAP),
    };
    const root = await this.projectRoot(project);
    await this.write(projectRuleRunsPath(root), next);
    return run;
  }

  async updateRun(project: string, runId: string, patch: Partial<RuleRun>) {
    const file = await this.readRuns(project);
    const index = file.runs.findIndex((run) => run.id === runId);
    if (index < 0) throw new Error(`Unknown rule run: ${runId}`);
    const current = file.runs[index];
    const processed =
      patch.transactionsProcessed ?? current.transactionsProcessed;
    const modified =
      patch.transactionsModified ?? current.transactionsModified;
    const updated: RuleRun = {
      ...current,
      ...patch,
      transactionsBlocked:
        patch.transactionsBlocked ??
        ruleBlockedCount(processed, modified),
    };
    const runs = [...file.runs];
    runs[index] = updated;
    const root = await this.projectRoot(project);
    await this.write(projectRuleRunsPath(root), { version: 1, runs });
    return updated;
  }

  async startRun(
    project: string,
    input: {
      ruleId: string | null;
      ruleName: string;
      queued: number;
      executionType?: RuleRun["executionType"];
    },
  ) {
    const run: RuleRun = {
      id: randomUUID(),
      ruleId: input.ruleId,
      ruleName: input.ruleName,
      executionType: input.executionType ?? "manual",
      status: "pending",
      executedAt: new Date().toISOString(),
      transactionsQueued: input.queued,
      transactionsProcessed: 0,
      transactionsModified: 0,
      transactionsBlocked: 0,
    };
    return this.appendRun(project, run);
  }

  async completeRun(
    project: string,
    runId: string,
    result: {
      status: "success" | "failed";
      processed: number;
      modified: number;
      errorMessage?: string | null;
    },
  ) {
    return this.updateRun(project, runId, {
      status: result.status,
      transactionsProcessed: result.processed,
      transactionsModified: result.modified,
      transactionsBlocked: ruleBlockedCount(result.processed, result.modified),
      errorMessage: result.errorMessage ?? null,
    });
  }

  registry(options?: {
    accounts?: readonly string[];
    merchants?: readonly { value: string; label: string }[];
  }) {
    return createRuleRegistry(options);
  }

  private async migrateFromSourcesIfNeeded(
    project: string,
    current: RulesFile,
  ): Promise<RulesFile> {
    if (!this.ingestionStore || this.migrating.has(project)) return current;
    this.migrating.add(project);
    try {
      const config = await this.ingestionStore.readConfig(project);
      const legacy: MerchantRule[] = [];
      let hasLegacy = false;
      for (const source of config.sources) {
        if (Array.isArray(source.rules) && source.rules.length > 0) {
          hasLegacy = true;
          legacy.push(...source.rules);
        }
      }
      if (!hasLegacy) return current;
      const migrated = migrateMerchantRules(legacy);
      const next: RulesFile = { version: 1, rules: migrated };
      await this.writeRules(project, next);
      await this.ingestionStore.writeConfig(project, {
        ...config,
        sources: config.sources.map((source) => ({
          ...source,
          rules: [],
        })),
      });
      return next;
    } finally {
      this.migrating.delete(project);
    }
  }
}
