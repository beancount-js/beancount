import { json } from "@sveltejs/kit";
import { buildMerchantReviewClusters } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

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
    const sourceId = url.searchParams.get("sourceId");
    if (!sourceId?.trim()) {
      return json({ error: "sourceId is required." }, { status: 400 });
    }
    const preferredRunId = url.searchParams.get("runId") ?? undefined;
    const store = serverIngestion();
    await store.source(params.id, sourceId);
    const state = await store.readState(params.id);
    const latest = await store.latestSyncJob(params.id, sourceId);
    const result = buildMerchantReviewClusters(state.runs, sourceId, {
      preferredRunId,
      syncRunIds: latest?.runIds,
    });
    return json(result);
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
