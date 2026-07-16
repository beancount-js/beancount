import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { normalizeMerchant } from "@beancount-js/beangulp";
import {
  applyMerchantResolutionToPendingProposals,
  enrichProposal,
  rawMerchantLabel,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST({
  params,
  request,
}: {
  params: { id: string; runId: string; proposalId: string };
  request: Request;
}) {
  try {
    let merchantOnly = false;
    const labels = new Set<string>();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        merchantOnly?: unknown;
        normalizedLabels?: unknown;
      };
      merchantOnly = body.merchantOnly === true;
      if (Array.isArray(body.normalizedLabels)) {
        for (const item of body.normalizedLabels) {
          if (typeof item === "string" && item.trim()) {
            labels.add(normalizeMerchant(item));
          }
        }
      }
    }
    const store = serverIngestion();
    const run = await store.run(params.id, params.runId);
    const source = await store.sourceForRunSourceId(params.id, run.sourceId);
    const proposal = await store.proposal(
      params.id,
      params.runId,
      params.proposalId,
    );
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const { proposal: updated, debug } = await enrichProposal(
      source,
      proposal,
      entries,
      undefined,
      { projectId: params.id, store },
      { collectDebug: true, merchantOnly },
    );

    if (merchantOnly && updated.merchantResolution) {
      const label = rawMerchantLabel(updated);
      if (label) labels.add(normalizeMerchant(label));
      const state = await store.readState(params.id);
      const fanOut = applyMerchantResolutionToPendingProposals(
        state.runs,
        source.id,
        labels,
        updated.merchantResolution,
        { includeSuppressed: false },
      );
      const runs = fanOut.runs.map((item) => {
        if (item.id !== params.runId) return item;
        return {
          ...item,
          proposals: item.proposals.map((entry) =>
            entry.id === params.proposalId ? updated : entry,
          ),
        };
      });
      const written = await store.writeRuns(params.id, runs);
      return json({
        run:
          written.find((item) => item.id === params.runId) ??
          (await store.run(params.id, params.runId)),
        debug,
        updatedCount: fanOut.updatedCount,
      });
    }

    return json({
      run: await store.replaceProposal(params.id, params.runId, updated),
      debug,
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
