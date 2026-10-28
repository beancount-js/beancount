import type { IngestionSyncJob } from "@beancount-js/server";
import { createIngestionApi, ingestionPath } from "./api";
import { useBeancountController } from "../../controller/context";
import type { BeancountControllerActions } from "../../controller/contracts";

export type SyncJobEvent =
  | { type: "snapshot"; job: IngestionSyncJob }
  | { type: "progress"; job: IngestionSyncJob }
  | { type: "done"; job: IngestionSyncJob }
  | { type: "error"; job: IngestionSyncJob };

export function createIngestionSync(
  request: BeancountControllerActions["request"],
) {
  const { ingestionJson } = createIngestionApi(request);
  async function startIngestionSync(
    projectId: string,
    sourceId: string,
    mode: "sync" | "ai-rerun" = "sync",
  ) {
    return ingestionJson<{
      jobId: string;
      status: IngestionSyncJob["status"];
      job: IngestionSyncJob;
      created: boolean;
    }>(ingestionPath(projectId, "/sync"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId, mode }),
    });
  }

  async function readIngestionSyncJob(projectId: string, jobId: string) {
    return ingestionJson<IngestionSyncJob>(
      ingestionPath(projectId, `/sync/${encodeURIComponent(jobId)}`),
    );
  }

  async function latestIngestionSyncJob(projectId: string, sourceId?: string) {
    const suffix = sourceId
      ? `/sync?sourceId=${encodeURIComponent(sourceId)}`
      : "/sync";
    return ingestionJson<IngestionSyncJob | null>(
      ingestionPath(projectId, suffix),
    );
  }

  async function readSyncEventStream(
    response: Response,
    onEvent: (event: SyncJobEvent) => void,
    signal?: AbortSignal,
  ) {
    if (!response.body)
      throw new Error("Sync response did not include a stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onEvent(JSON.parse(line) as SyncJobEvent);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) onEvent(JSON.parse(buffer) as SyncJobEvent);
  }

  async function subscribeIngestionSyncEvents(
    projectId: string,
    jobId: string,
    onEvent: (event: SyncJobEvent) => void,
    signal?: AbortSignal,
  ) {
    const response = await request(
      ingestionPath(projectId, `/sync/${encodeURIComponent(jobId)}/events`),
      { signal },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message =
        typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : response.statusText || `HTTP ${response.status}`;
      throw new Error(message);
    }
    await readSyncEventStream(response, onEvent, signal);
  }

  return {
    startIngestionSync,
    readIngestionSyncJob,
    latestIngestionSyncJob,
    readSyncEventStream,
    subscribeIngestionSyncEvents,
  };
}
export function useIngestionSync() {
  return useBeancountController().services.sync;
}
