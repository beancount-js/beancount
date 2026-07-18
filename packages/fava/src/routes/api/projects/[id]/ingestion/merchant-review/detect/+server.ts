import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import type { IngestionRun } from "@beancount-js/beangulp";
import {
  applyMerchantResolutionToPendingProposals,
  buildMerchantReviewClusters,
  enrichProposals,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function proposalKey(runId: string, proposalId: string) {
  return `${runId}\u0000${proposalId}`;
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = (await request.json()) as {
      sourceId?: unknown;
      clusterIds?: unknown;
    };
    const sourceId =
      typeof body.sourceId === "string" ? body.sourceId.trim() : "";
    if (!sourceId)
      return json({ error: "sourceId is required." }, { status: 400 });
    if (
      body.clusterIds !== undefined &&
      (!Array.isArray(body.clusterIds) ||
        !body.clusterIds.length ||
        body.clusterIds.some((id) => typeof id !== "string" || !id.trim()))
    ) {
      return json(
        { error: "clusterIds must be a non-empty list of cluster ids." },
        { status: 400 },
      );
    }
    const selectedClusterIds = body.clusterIds
      ? new Set(body.clusterIds.map((id) => id.trim()))
      : undefined;

    const store = serverIngestion();
    const [source, runs, latest, workspace] = await Promise.all([
      store.source(params.id, sourceId),
      store.readRuns(params.id),
      store.latestSyncJob(params.id, sourceId),
      serverWorkspace(),
    ]);
    const availableClusters = buildMerchantReviewClusters(runs, sourceId, {
      syncRunIds: latest?.runIds,
    }).clusters;
    const clusters = selectedClusterIds
      ? availableClusters.filter((cluster) =>
          selectedClusterIds.has(cluster.id),
        )
      : availableClusters;
    if (selectedClusterIds && clusters.length !== selectedClusterIds.size) {
      return json(
        {
          error:
            "One or more selected merchant clusters are no longer current.",
        },
        { status: 409 },
      );
    }
    if (!clusters.length) return json({ runIds: [], clusters: 0, calls: 0 });

    const snapshot = await workspace.readProject(params.id);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const primaryLookup = new Map(
      runs.flatMap((run) =>
        run.proposals.map(
          (proposal) => [proposalKey(run.id, proposal.id), proposal] as const,
        ),
      ),
    );
    const primaries = clusters.map((cluster) => {
      const proposal = primaryLookup.get(
        proposalKey(cluster.primary.runId, cluster.primary.proposalId),
      );
      if (!proposal) throw new Error("Merchant review proposal was not found.");
      return proposal;
    });
    const detectionRules = await serverRules().listActive(params.id);
    const enriched = await enrichProposals(
      source,
      primaries,
      entries,
      undefined,
      { projectId: params.id, store },
      { merchantOnly: true, detectionRules, source: "enrich" },
    );

    let nextRuns = runs.map((run) => ({ ...run }));
    for (const [index, cluster] of clusters.entries()) {
      const updated = enriched.proposals[index]!;
      if (updated.merchantResolution) {
        nextRuns = applyMerchantResolutionToPendingProposals(
          nextRuns,
          source.id,
          new Set(cluster.members.map((member) => member.normalizedLabel)),
          updated.merchantResolution,
          { includeSuppressed: false },
        ).runs;
      }
      nextRuns = nextRuns.map((run) =>
        run.id !== cluster.primary.runId
          ? run
          : {
              ...run,
              proposals: run.proposals.map((proposal) =>
                proposal.id === cluster.primary.proposalId ? updated : proposal,
              ),
            },
      );
    }

    const callsByRun = new Map<
      string,
      Map<string, (typeof enriched.debug.calls)[number]>
    >();
    for (const [index, cluster] of clusters.entries()) {
      const calls = enriched.proposals[index]!.lastAiEnrichment?.calls ?? [];
      const byId = callsByRun.get(cluster.primary.runId) ?? new Map();
      for (const call of calls)
        byId.set(call.callId ?? `${call.id}:${call.at}`, call);
      callsByRun.set(cluster.primary.runId, byId);
    }
    nextRuns = nextRuns.map((run) => {
      const calls = [...(callsByRun.get(run.id)?.values() ?? [])];
      return calls.length
        ? { ...run, audit: { ai: [...(run.audit?.ai ?? []), ...calls] } }
        : run;
    }) as IngestionRun[];
    await store.writeRuns(params.id, nextRuns);
    return json({
      runIds: nextRuns.map((run) => run.id),
      clusters: clusters.length,
      calls: enriched.debug.calls.length,
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
