import { json } from "@sveltejs/kit";
import {
  latestSyncJobForSource,
  startIngestionSync,
} from "$lib/server/sync-jobs";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const sourceId = url.searchParams.get("sourceId") ?? undefined;
    const job = await latestSyncJobForSource(params.id, sourceId || undefined);
    return json(job);
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    const { sourceId } = body as {
      sourceId?: unknown;
    };
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      return json({ error: "A sourceId is required." }, { status: 400 });
    }
    const { job, created } = await startIngestionSync({
      projectId: params.id,
      sourceId: sourceId.trim(),
    });
    return json(
      { jobId: job.id, status: job.status, job, created },
      { status: created ? 202 : 200 },
    );
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
