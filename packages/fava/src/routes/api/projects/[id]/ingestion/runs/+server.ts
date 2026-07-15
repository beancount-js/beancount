import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { ingestSource } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
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
    const { sourceId, model } = await request.json();
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
    const run = await ingestSource(
      source,
      await store.readState(params.id),
      entries,
      typeof model === "string" ? model : undefined,
      { projectId: params.id, store },
    );
    await store.saveRun(params.id, run);
    return json(run, { status: 201 });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
