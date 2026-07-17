import { randomUUID } from "node:crypto";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  AsyncEventQueue,
  enrichExistingSourceRuns,
  expandIngestionSource,
  ingestSource,
  type IngestionSyncJob,
  type IngestionSyncJobKind,
  type IngestionSyncJobSummary,
} from "@beancount-js/server";
import { serverIngestion } from "./ingestion";
import { serverRules } from "./rules";
import { serverWorkspace } from "./workspace";

export type SyncJobEvent =
  | { type: "snapshot"; job: IngestionSyncJob }
  | { type: "progress"; job: IngestionSyncJob }
  | { type: "done"; job: IngestionSyncJob }
  | { type: "error"; job: IngestionSyncJob };

type ActiveSyncJob = {
  jobId: string;
  projectId: string;
  sourceId: string;
  listeners: Set<AsyncEventQueue<SyncJobEvent>>;
  latest: IngestionSyncJob;
};

const activeByJobId = new Map<string, ActiveSyncJob>();
const activeBySourceKey = new Map<string, string>();
const interruptedProjects = new Set<string>();

function sourceKey(projectId: string, sourceId: string) {
  return `${projectId}:${sourceId}`;
}

function emptySummary(): IngestionSyncJobSummary {
  return {
    seen: 0,
    imported: 0,
    ready: 0,
    needsReview: 0,
    duplicates: 0,
    invalid: 0,
    held: 0,
    excluded: 0,
  };
}

function mergeSummaries(
  runs: Array<{
    summary: IngestionSyncJobSummary;
  }>,
): IngestionSyncJobSummary {
  return runs.reduce(
    (acc, run) => ({
      seen: acc.seen + run.summary.seen,
      imported: acc.imported + run.summary.imported,
      ready: acc.ready + run.summary.ready,
      needsReview: acc.needsReview + run.summary.needsReview,
      duplicates: acc.duplicates + run.summary.duplicates,
      invalid: acc.invalid + run.summary.invalid,
      held: acc.held + run.summary.held,
    }),
    emptySummary(),
  );
}

async function ensureInterruptedFailed(projectId: string) {
  if (interruptedProjects.has(projectId)) return;
  interruptedProjects.add(projectId);
  await serverIngestion().failInterruptedSyncJobs(projectId);
}

function publish(active: ActiveSyncJob, event: SyncJobEvent) {
  active.latest = event.job;
  for (const listener of active.listeners) {
    listener.push(event);
  }
}

async function persistAndPublish(
  active: ActiveSyncJob,
  job: IngestionSyncJob,
  type: SyncJobEvent["type"] = "progress",
) {
  await serverIngestion().saveSyncJob(active.projectId, job);
  publish(active, { type, job });
}

function runBelongsToSource(runSourceId: string, connectionId: string) {
  return (
    runSourceId === connectionId || runSourceId.startsWith(`${connectionId}:`)
  );
}

async function runAiRerunJob(active: ActiveSyncJob, job: IngestionSyncJob) {
  const store = serverIngestion();
  let current: IngestionSyncJob = {
    ...job,
    kind: "ai-rerun",
    status: "running",
    progress: {
      stage: "process",
      message: "Starting AI enrichment…",
    },
  };
  await persistAndPublish(active, current, "progress");

  try {
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(active.projectId);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const source = await store.source(active.projectId, active.sourceId);
    const sourceRuns = (await store.readRuns(active.projectId)).filter((run) =>
      runBelongsToSource(run.sourceId, active.sourceId),
    );
    if (!sourceRuns.length) {
      throw new Error("No import runs are available to enrich.");
    }

    const detectionRules = await serverRules().listActive(active.projectId);
    const enriched = await enrichExistingSourceRuns(
      source,
      sourceRuns,
      entries,
      undefined,
      { projectId: active.projectId, store },
      {
        jobId: active.jobId,
        detectionRules,
        onProgress: async (progress) => {
          current = {
            ...current,
            progress: {
              stage: "process",
              message: progress.message,
              seen: progress.index,
              imported: progress.total,
            },
          };
          await persistAndPublish(active, current, "progress");
        },
      },
    );

    current = {
      ...current,
      progress: {
        ...current.progress,
        stage: "saving",
        message: "Saving enriched proposals…",
      },
    };
    await persistAndPublish(active, current, "progress");

    const runIds: string[] = [];
    for (const run of enriched) {
      await store.saveRun(active.projectId, run);
      runIds.push(run.id);
    }

    const summary = mergeSummaries(
      enriched.map((run) => ({
        summary: {
          seen: run.summary.total,
          imported: run.summary.total - run.summary.duplicates,
          ready: run.summary.ready,
          needsReview: run.summary.needsReview,
          duplicates: run.summary.duplicates,
          invalid: run.summary.invalid,
          held: run.summary.held,
        },
      })),
    );
    const aiFailed = enriched.reduce(
      (count, run) =>
        count +
        run.proposals.filter(
          (proposal) => proposal.lastAiEnrichment?.ok === false,
        ).length,
      0,
    );

    current = {
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      runIds,
      summary,
      progress: {
        stage: "complete",
        message:
          aiFailed > 0
            ? `AI enriched ${summary.imported} proposal${summary.imported === 1 ? "" : "s"} (${aiFailed} with errors — open a proposal to review)`
            : `AI enriched ${summary.imported} proposal${summary.imported === 1 ? "" : "s"}`,
        seen: summary.imported,
        imported: summary.imported,
      },
    };
    await persistAndPublish(active, current, "done");
  } catch (error) {
    current = {
      ...current,
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      progress: {
        ...current.progress,
        stage: "complete",
        message:
          error instanceof Error
            ? error.message
            : "AI enrichment failed unexpectedly.",
      },
    };
    await persistAndPublish(active, current, "error");
  } finally {
    for (const listener of active.listeners) {
      listener.close();
    }
    active.listeners.clear();
    activeByJobId.delete(active.jobId);
    const key = sourceKey(active.projectId, active.sourceId);
    if (activeBySourceKey.get(key) === active.jobId) {
      activeBySourceKey.delete(key);
    }
  }
}

async function runSyncJob(active: ActiveSyncJob, job: IngestionSyncJob) {
  if (job.kind === "ai-rerun") {
    await runAiRerunJob(active, job);
    return;
  }

  const store = serverIngestion();
  let current: IngestionSyncJob = {
    ...job,
    status: "running",
    progress: {
      ...job.progress,
      stage: "account",
      message: "Starting sync…",
    },
  };
  await persistAndPublish(active, current, "progress");

  try {
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(active.projectId);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const source = await store.source(active.projectId, active.sourceId);
    let state = await store.readState(active.projectId);
    const detectionRules = await serverRules().listActive(active.projectId);
    const { runs, syncStatePatches } = await ingestSource(
      source,
      state,
      entries,
      undefined,
      { projectId: active.projectId, store },
      {
        detectionRules,
        onProgress: async (progress) => {
          current = {
            ...current,
            progress: {
              stage: progress.stage,
              message: progress.message,
              accountIndex: progress.accountIndex,
              accountTotal: progress.accountTotal,
              accountName: progress.accountName,
              pagesFetched: progress.pagesFetched,
              seen: progress.seen,
              imported: progress.imported,
            },
          };
          await persistAndPublish(active, current, "progress");
        },
      },
    );

    current = {
      ...current,
      progress: {
        ...current.progress,
        stage: "saving",
        message: "Saving import runs…",
      },
    };
    await persistAndPublish(active, current, "progress");

    const runIds: string[] = [];
    for (const run of runs) {
      await store.saveRun(active.projectId, run, {
        syncState: syncStatePatches[run.sourceId],
      });
      runIds.push(run.id);
      state = await store.readState(active.projectId);
    }

    const summary = mergeSummaries(
      runs.map((run) => ({
        summary: {
          seen: run.summary.total,
          imported: run.summary.total - run.summary.duplicates,
          ready: run.summary.ready,
          needsReview: run.summary.needsReview,
          duplicates: run.summary.duplicates,
          invalid: run.summary.invalid,
          held: run.summary.held,
        },
      })),
    );

    current = {
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      runIds,
      summary,
      progress: {
        stage: "complete",
        message: `Synced ${summary.seen} transaction${summary.seen === 1 ? "" : "s"}`,
        accountIndex: current.progress.accountTotal,
        accountTotal: current.progress.accountTotal,
        seen: summary.seen,
        imported: summary.imported,
      },
    };
    await persistAndPublish(active, current, "done");
  } catch (error) {
    current = {
      ...current,
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      progress: {
        ...current.progress,
        stage: "complete",
        message:
          error instanceof Error ? error.message : "Sync failed unexpectedly.",
      },
    };
    await persistAndPublish(active, current, "error");
  } finally {
    for (const listener of active.listeners) {
      listener.close();
    }
    active.listeners.clear();
    activeByJobId.delete(active.jobId);
    const key = sourceKey(active.projectId, active.sourceId);
    if (activeBySourceKey.get(key) === active.jobId) {
      activeBySourceKey.delete(key);
    }
  }
}

export async function startIngestionSync(options: {
  projectId: string;
  sourceId: string;
  kind?: IngestionSyncJobKind;
}) {
  const { projectId, sourceId } = options;
  const kind: IngestionSyncJobKind = options.kind ?? "sync";
  await ensureInterruptedFailed(projectId);

  const existingId = activeBySourceKey.get(sourceKey(projectId, sourceId));
  if (existingId) {
    const existing = await serverIngestion().readSyncJob(projectId, existingId);
    return { job: existing, created: false };
  }

  const store = serverIngestion();
  const diskActive = await store.findActiveSyncJob(projectId, sourceId);
  if (diskActive && activeByJobId.has(diskActive.id)) {
    return { job: diskActive, created: false };
  }

  const source = await store.source(projectId, sourceId);
  if (kind === "sync") expandIngestionSource(source);

  const jobId = `${kind === "ai-rerun" ? "ai" : "sync"}:${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const job: IngestionSyncJob = {
    id: jobId,
    projectId,
    sourceId,
    kind,
    status: "queued",
    startedAt,
    progress: {
      stage: "queued",
      message: kind === "ai-rerun" ? "Queued AI enrichment…" : "Queued…",
    },
    runIds: [],
  };
  await store.saveSyncJob(projectId, job);

  const active: ActiveSyncJob = {
    jobId,
    projectId,
    sourceId,
    listeners: new Set(),
    latest: job,
  };
  activeByJobId.set(jobId, active);
  activeBySourceKey.set(sourceKey(projectId, sourceId), jobId);

  void runSyncJob(active, job);

  return { job, created: true };
}

export function getActiveSyncJob(jobId: string) {
  return activeByJobId.get(jobId) ?? null;
}

export async function readSyncJobSnapshot(projectId: string, jobId: string) {
  await ensureInterruptedFailed(projectId);
  return serverIngestion().readSyncJob(projectId, jobId);
}

export async function latestSyncJobForSource(
  projectId: string,
  sourceId?: string,
) {
  await ensureInterruptedFailed(projectId);
  const memoryId = sourceId
    ? activeBySourceKey.get(sourceKey(projectId, sourceId))
    : undefined;
  if (memoryId) {
    return serverIngestion().readSyncJob(projectId, memoryId);
  }
  return serverIngestion().latestSyncJob(projectId, sourceId);
}

export async function subscribeSyncJobEvents(
  projectId: string,
  jobId: string,
): Promise<{
  job: IngestionSyncJob;
  events: AsyncIterable<SyncJobEvent>;
}> {
  await ensureInterruptedFailed(projectId);
  const job = await serverIngestion().readSyncJob(projectId, jobId);
  const active = activeByJobId.get(jobId);
  if (!active) {
    async function* finished() {
      yield {
        type:
          job.status === "failed"
            ? ("error" as const)
            : job.status === "completed"
              ? ("done" as const)
              : ("snapshot" as const),
        job,
      } satisfies SyncJobEvent;
    }
    return { job, events: finished() };
  }

  const session = active;
  const listener = new AsyncEventQueue<SyncJobEvent>();
  session.listeners.add(listener);
  async function* live() {
    try {
      yield { type: "snapshot", job: session.latest } satisfies SyncJobEvent;
      for await (const event of listener) {
        yield event;
        if (event.type === "done" || event.type === "error") break;
      }
    } finally {
      session.listeners.delete(listener);
      listener.close();
    }
  }
  return { job, events: live() };
}
