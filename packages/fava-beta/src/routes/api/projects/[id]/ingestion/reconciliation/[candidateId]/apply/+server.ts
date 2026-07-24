import { json } from "@sveltejs/kit";
import { applyReconciliation } from "@beancount-js/server";
import { serverIngestion, serverReconciliations } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST({
  params,
}: {
  params: { id: string; candidateId: string };
}) {
  try {
    const workspace = await serverWorkspace();
    return json(
      await applyReconciliation({
        projectId: params.id,
        candidateId: params.candidateId,
        ingestionStore: serverIngestion(),
        reconciliationStore: serverReconciliations(),
        workspace,
      }),
    );
  } catch (error) {
    const text = message(error);
    return json(
      { error: text },
      { status: text.includes("changed") ? 409 : 400 },
    );
  }
}
