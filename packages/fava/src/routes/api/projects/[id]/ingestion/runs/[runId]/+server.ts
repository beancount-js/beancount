import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  categoryAccountsForSource,
  serverIngestion,
} from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({
  params,
}: {
  params: { id: string; runId: string };
}) {
  try {
    return json(await serverIngestion().run(params.id, params.runId));
  } catch (error) {
    return json({ error: message(error) }, { status: 404 });
  }
}

export async function PATCH({
  params,
  request,
}: {
  params: { id: string; runId: string };
  request: Request;
}) {
  try {
    const { proposalId, account } = await request.json();
    if (typeof proposalId !== "string" || typeof account !== "string") {
      return json(
        { error: "proposalId and account are required." },
        { status: 400 },
      );
    }
    const snapshot = await (await serverWorkspace()).readProject(params.id);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const run = await serverIngestion().run(params.id, params.runId);
    const source = await serverIngestion().source(params.id, run.sourceId);
    if (
      !categoryAccountsForSource(
        source,
        entries.flatMap((entry) => entry.accounts),
      ).includes(account)
    ) {
      return json(
        { error: "Choose an account allowed by this source's category scope." },
        { status: 400 },
      );
    }
    return json(
      await serverIngestion().updateProposal(
        params.id,
        params.runId,
        proposalId,
        account,
      ),
    );
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
