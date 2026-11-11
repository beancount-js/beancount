import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { ingestSource } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function boundedInteger(
  value: string | null,
  fallback: number,
  maximum: number,
) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  const sourceId = url.searchParams.get("sourceId")?.trim() || undefined;
  return json(
    await serverIngestion().listRuns(params.id, {
      offset: boundedInteger(url.searchParams.get("offset"), 0, 1_000_000),
      limit: boundedInteger(url.searchParams.get("limit"), 25, 100),
      sourceId,
    }),
  );
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
    const { runs, syncStatePatches } = await ingestSource(
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
      await store.saveRun(params.id, run, {
        syncState: syncStatePatches[run.sourceId],
      });
      state = await store.readState(params.id);
    }
    return json(runs.length === 1 ? runs[0] : { runs }, { status: 201 });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
