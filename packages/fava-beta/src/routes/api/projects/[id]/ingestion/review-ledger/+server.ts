import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { buildIngestionReviewLedger } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({ params }: { params: { id: string } }) {
  try {
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const [directives, , options] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const ingestion = serverIngestion();
    const [runs, config] = await Promise.all([
      ingestion.readRuns(params.id),
      ingestion.readConfig(params.id),
    ]);
    return json({
      ledger: buildIngestionReviewLedger({
        runs,
        directives,
        beancountOptions: options,
        sources: config.sources,
      }),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
