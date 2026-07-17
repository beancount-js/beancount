import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { IngestionRun } from "@beancount-js/beangulp";
import { projectIngestionRunsRoot } from "./paths";
import type { ProjectRootResolver } from "./merchant";

const INDEX_VERSION = 1;
const RUN_FILE_VERSION = 1;

export type IngestionRunReviewState = "pending" | "completed";

/** Lightweight list entry; the full proposal audit stays in its run file. */
export interface IngestionRunSummary {
  id: string;
  sourceId: string;
  startedAt: string;
  completedAt: string;
  reviewState: IngestionRunReviewState;
  summary: IngestionRun["summary"];
  updatedAt: string;
}

export interface IngestionRunPage {
  runs: IngestionRunSummary[];
  total: number;
  offset: number;
  limit: number;
}

interface PersistedIngestionRun {
  version: typeof RUN_FILE_VERSION;
  updatedAt: string;
  run: IngestionRun;
}

interface IngestionRunIndex {
  version: typeof INDEX_VERSION;
  runs: IngestionRunSummary[];
}

function runFileName(runId: string) {
  const digest = createHash("sha256").update(runId).digest("hex");
  return `${digest}.json`;
}

function reviewState(run: IngestionRun): IngestionRunReviewState {
  return run.proposals.some(
    (proposal) =>
      proposal.status === "ready" ||
      proposal.status === "needs-review" ||
      proposal.status === "held",
  )
    ? "pending"
    : "completed";
}

function summaryFor(
  run: IngestionRun,
  updatedAt = new Date().toISOString(),
): IngestionRunSummary {
  return {
    id: run.id,
    sourceId: run.sourceId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    reviewState: reviewState(run),
    summary: run.summary,
    updatedAt,
  };
}

function newestFirst(left: IngestionRunSummary, right: IngestionRunSummary) {
  return (
    right.completedAt.localeCompare(left.completedAt) ||
    right.startedAt.localeCompare(left.startedAt) ||
    right.id.localeCompare(left.id)
  );
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

/**
 * Project-local immutable-by-default run archive. Full records live in one
 * file per run; the index is a disposable, compact listing cache.
 */
export class FilesystemIngestionRunArchive {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly resolveProjectRoot: ProjectRootResolver) {}

  private async root(project: string) {
    return projectIngestionRunsRoot(await this.resolveProjectRoot(project));
  }

  private async path(project: string, runId: string) {
    return join(await this.root(project), runFileName(runId));
  }

  private async indexPath(project: string) {
    return join(await this.root(project), "index.json");
  }

  private async withLock<T>(project: string, work: () => Promise<T>) {
    const previous = this.locks.get(project) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(project, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(project) === current) this.locks.delete(project);
    }
  }

  private async writeJson(path: string, value: unknown) {
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, path);
  }

  private async readIndex(project: string) {
    let raw: unknown;
    try {
      raw = await readJson<unknown>(await this.indexPath(project), null);
    } catch (error: unknown) {
      // The index is only a cache of the individual run records. Rebuild it
      // when a partial/manual write left it malformed rather than losing the
      // audit history that it indexes.
      if (error instanceof SyntaxError) return undefined;
      throw error;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const index = raw as Partial<IngestionRunIndex>;
    if (index.version !== INDEX_VERSION || !Array.isArray(index.runs)) {
      return undefined;
    }
    return {
      version: INDEX_VERSION,
      runs: index.runs.filter(
        (run): run is IngestionRunSummary =>
          !!run &&
          typeof run.id === "string" &&
          typeof run.sourceId === "string" &&
          typeof run.startedAt === "string" &&
          typeof run.completedAt === "string" &&
          (run.reviewState === "pending" || run.reviewState === "completed") &&
          !!run.summary &&
          typeof run.updatedAt === "string",
      ),
    } satisfies IngestionRunIndex;
  }

  private async readPersisted(project: string, runId: string) {
    const persisted = await readJson<PersistedIngestionRun | undefined>(
      await this.path(project, runId),
      undefined,
    );
    if (
      !persisted ||
      persisted.version !== RUN_FILE_VERSION ||
      !persisted.run ||
      persisted.run.id !== runId
    ) {
      throw new Error(`Unknown ingestion run: ${runId}`);
    }
    return persisted;
  }

  private async readAllPersisted(project: string) {
    const root = await this.root(project);
    let names: string[];
    try {
      names = await fs.readdir(root);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const runs: PersistedIngestionRun[] = [];
    for (const name of names) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      try {
        const value = JSON.parse(
          await fs.readFile(join(root, name), "utf8"),
        ) as PersistedIngestionRun;
        if (
          value.version === RUN_FILE_VERSION &&
          value.run &&
          typeof value.run.id === "string"
        ) {
          runs.push(value);
        }
      } catch {
        // One manually damaged audit record must not block other run history.
      }
    }
    return runs;
  }

  private async rebuildIndex(project: string) {
    const runs = await this.readAllPersisted(project);
    const index: IngestionRunIndex = {
      version: INDEX_VERSION,
      runs: runs
        .map((item) => summaryFor(item.run, item.updatedAt))
        .sort(newestFirst),
    };
    await this.writeJson(await this.indexPath(project), index);
    return index;
  }

  /** Import legacy state records exactly once before the caller clears them. */
  async ensure(project: string, legacyRuns: readonly IngestionRun[] = []) {
    return this.withLock(project, async () => {
      for (const run of legacyRuns) {
        await this.writeJson(await this.path(project, run.id), {
          version: RUN_FILE_VERSION,
          updatedAt: new Date().toISOString(),
          run,
        } satisfies PersistedIngestionRun);
      }
      const index = await this.readIndex(project);
      return legacyRuns.length > 0 || !index
        ? this.rebuildIndex(project)
        : index;
    });
  }

  async read(project: string, runId: string) {
    await this.ensure(project);
    return (await this.readPersisted(project, runId)).run;
  }

  async readAll(project: string): Promise<IngestionRun[]> {
    const index = await this.ensure(project);
    const runs: IngestionRun[] = [];
    for (const item of index.runs) {
      try {
        runs.push((await this.readPersisted(project, item.id)).run);
      } catch {
        return (await this.rebuildIndex(project)).runs.length
          ? this.readAll(project)
          : [];
      }
    }
    return runs;
  }

  async list(
    project: string,
    options: { limit?: number; offset?: number; sourceId?: string } = {},
  ): Promise<IngestionRunPage> {
    const index = await this.ensure(project);
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(100, Math.max(1, options.limit ?? 25));
    const sourceId = options.sourceId;
    const runs = sourceId
      ? index.runs.filter(
          (run) =>
            run.sourceId === sourceId ||
            run.sourceId.startsWith(`${sourceId}:`),
        )
      : index.runs;
    return {
      runs: runs.slice(offset, offset + limit),
      total: runs.length,
      offset,
      limit,
    };
  }

  async write(project: string, run: IngestionRun) {
    return this.writeMany(project, [run]).then((runs) => runs[0]!);
  }

  async writeMany(project: string, runs: readonly IngestionRun[]) {
    if (!runs.length) return [] as IngestionRun[];
    await this.ensure(project);
    return this.withLock(project, async () => {
      const index =
        (await this.readIndex(project)) ?? (await this.rebuildIndex(project));
      const summaries = new Map(index.runs.map((item) => [item.id, item]));
      const updatedAt = new Date().toISOString();
      for (const run of runs) {
        await this.writeJson(await this.path(project, run.id), {
          version: RUN_FILE_VERSION,
          updatedAt,
          run,
        } satisfies PersistedIngestionRun);
        summaries.set(run.id, summaryFor(run, updatedAt));
      }
      await this.writeJson(await this.indexPath(project), {
        version: INDEX_VERSION,
        runs: [...summaries.values()].sort(newestFirst),
      } satisfies IngestionRunIndex);
      return [...runs];
    });
  }
}
