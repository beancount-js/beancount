import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { ingestSource } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({ params }: { params: { id: string } }) {
  const state = await serverIngestion().readState(params.id);
  return json(state.runs);
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
    const { sourceId, model, accountId } = body as {
      sourceId?: unknown;
      model?: unknown;
      accountId?: unknown;
    };
    if (typeof sourceId !== "string")
      return json({ error: "A sourceId is required." }, { status: 400 });
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const store = serverIngestion();
    const source = await store.source(params.id, sourceId);
    let state = await store.readState(params.id);
    const detectionRules = await serverRules().listActive(params.id);
    const runs = await ingestSource(
      source,
      state,
      entries,
      typeof model === "string" ? model : undefined,
      { projectId: params.id, store },
      {
        ...(typeof accountId === "string" ? { accountId } : {}),
        detectionRules,
      },
    );
    for (const run of runs) {
      await store.saveRun(params.id, run);
      state = await store.readState(params.id);
    }
    return json(runs.length === 1 ? runs[0] : { runs }, { status: 201 });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
