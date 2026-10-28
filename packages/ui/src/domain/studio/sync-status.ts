import { writable, derived, type Readable } from "svelte/store";
import type { IngestionSyncJob } from "@beancount-js/server";
import type { SyncJobEvent, createIngestionSync } from "../ingestion/sync";
import { useBeancountController } from "../../controller/context";

export type ActiveSyncTrack = {
  projectId: string;
  sourceId: string;
  sourceName: string;
  job: IngestionSyncJob;
};

export function createSyncStatus(sync: ReturnType<typeof createIngestionSync>) {
  const {
    latestIngestionSyncJob,
    startIngestionSync,
    subscribeIngestionSyncEvents,
  } = sync;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const tracks = writable<ActiveSyncTrack[]>([]);
  const controllers = new Map<string, AbortController>();

  function trackKey(projectId: string, sourceId: string) {
    return `${projectId}:${sourceId}`;
  }

  function upsertTrack(track: ActiveSyncTrack) {
    tracks.update((items) => {
      const next = items.filter(
        (item) =>
          !(
            item.projectId === track.projectId &&
            item.sourceId === track.sourceId
          ),
      );
      if (track.job.status === "queued" || track.job.status === "running") {
        next.push(track);
      }
      return next;
    });
  }

  function removeTrack(projectId: string, sourceId: string) {
    tracks.update((items) =>
      items.filter(
        (item) => !(item.projectId === projectId && item.sourceId === sourceId),
      ),
    );
    const key = trackKey(projectId, sourceId);
    controllers.get(key)?.abort();
    controllers.delete(key);
  }

  function applyEvent(
    projectId: string,
    sourceId: string,
    sourceName: string,
    event: SyncJobEvent,
  ) {
    upsertTrack({
      projectId,
      sourceId,
      sourceName,
      job: event.job,
    });
    if (event.type === "done" || event.type === "error") {
      // Keep completed/failed briefly then drop from global indicator.
      const timer = setTimeout(() => {
        timers.delete(timer);
        removeTrack(projectId, sourceId);
      }, 4000);
      timers.add(timer);
    }
  }

  const activeSyncTracks: Readable<ActiveSyncTrack[]> = {
    subscribe: tracks.subscribe,
  };

  const hasActiveSync = derived(tracks, ($tracks) =>
    $tracks.some(
      (track) =>
        track.job.status === "queued" || track.job.status === "running",
    ),
  );

  async function watchIngestionSync(options: {
    projectId: string;
    sourceId: string;
    sourceName: string;
    job: IngestionSyncJob;
    onUpdate?: (job: IngestionSyncJob) => void;
  }) {
    const { projectId, sourceId, sourceName, job, onUpdate } = options;
    const key = trackKey(projectId, sourceId);
    controllers.get(key)?.abort();
    const controller = new AbortController();
    controllers.set(key, controller);

    upsertTrack({ projectId, sourceId, sourceName, job });
    onUpdate?.(job);

    if (job.status !== "queued" && job.status !== "running") {
      return job;
    }

    try {
      await subscribeIngestionSyncEvents(
        projectId,
        job.id,
        (event) => {
          applyEvent(projectId, sourceId, sourceName, event);
          onUpdate?.(event.job);
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return job;
      throw error;
    }
    return job;
  }

  async function beginIngestionSync(options: {
    projectId: string;
    sourceId: string;
    sourceName: string;
    onUpdate?: (job: IngestionSyncJob) => void;
  }) {
    const started = await startIngestionSync(
      options.projectId,
      options.sourceId,
    );
    let latest = started.job;
    await watchIngestionSync({
      projectId: options.projectId,
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      job: started.job,
      onUpdate: (job) => {
        latest = job;
        options.onUpdate?.(job);
      },
    });
    return latest;
  }

  async function restoreIngestionSyncWatch(options: {
    projectId: string;
    sourceId: string;
    sourceName: string;
    onUpdate?: (job: IngestionSyncJob) => void;
  }) {
    const job = await latestIngestionSyncJob(
      options.projectId,
      options.sourceId,
    );
    if (!job) return null;
    if (job.status === "queued" || job.status === "running") {
      await watchIngestionSync({
        projectId: options.projectId,
        sourceId: options.sourceId,
        sourceName: options.sourceName,
        job,
        onUpdate: options.onUpdate,
      });
    } else {
      options.onUpdate?.(job);
    }
    return job;
  }

  return {
    activeSyncTracks,
    hasActiveSync,
    watchIngestionSync,
    beginIngestionSync,
    restoreIngestionSyncWatch,
    dispose() {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      tracks.set([]);
    },
  };
}
export function useSyncStatus() {
  return useBeancountController().services.syncStatus;
}
