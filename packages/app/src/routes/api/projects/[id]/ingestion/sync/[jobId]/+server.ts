import { json } from "@sveltejs/kit";
import { readSyncJobSnapshot } from "$lib/server/sync-jobs";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({
  params,
}: {
  params: { id: string; jobId: string };
}) {
  try {
    const job = await readSyncJobSnapshot(params.id, params.jobId);
    return json(job);
  } catch (error) {
    const text = message(error);
    const status = text.startsWith("Unknown sync job") ? 404 : 400;
    return json({ error: text }, { status });
  }
}
