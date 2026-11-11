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
    const runs = await store.readRuns(params.id);
    const latest = await store.latestSyncJob(params.id, sourceId);
    const options = {
      preferredRunId,
      syncRunIds: latest?.runIds,
    };
    const pending = buildMerchantReviewClusters(runs, sourceId, options);
    const reviewed = buildMerchantReviewClusters(runs, sourceId, {
      ...options,
      mode: "reviewed",
    });
    return json({ ...pending, reviewedClusters: reviewed.clusters });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
