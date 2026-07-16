import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { enrichProposal } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST({
  params,
}: {
  params: { id: string; runId: string; proposalId: string };
}) {
  try {
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
      { collectDebug: true },
    );
    return json({
      run: await store.replaceProposal(params.id, params.runId, updated),
      debug,
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
