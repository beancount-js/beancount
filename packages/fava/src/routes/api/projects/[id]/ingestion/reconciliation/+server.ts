import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { buildReconciliationReview } from "@beancount-js/server";
import { compactReconciliationReview } from "$lib/reconciliation-review-response";
import { serverIngestion, serverReconciliations } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function review(projectId: string) {
  const workspace = await serverWorkspace();
  const snapshot = await workspace.readProject(projectId);
  const [entries] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );
  const ingestion = serverIngestion();
  const [config, runs, decisions] = await Promise.all([
    ingestion.readConfig(projectId),
    ingestion.readRuns(projectId),
    serverReconciliations().read(projectId),
  ]);
  return buildReconciliationReview({ config, runs, entries, decisions });
}

export async function GET({ params }: { params: { id: string } }) {
  try {
    return json(compactReconciliationReview(await review(params.id)));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}

export async function PUT({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.candidateId !== "string" ||
      (body.state !== "confirmed" && body.state !== "dismissed")
    ) {
      return json(
        {
          error: "candidateId and a confirmed or dismissed state are required.",
        },
        { status: 400 },
      );
    }
    if (
      body.canonicalObservationId !== undefined &&
      typeof body.canonicalObservationId !== "string"
    ) {
      return json(
        { error: "canonicalObservationId must be text." },
        { status: 400 },
      );
    }
    const current = await review(params.id);
    const candidate = current.candidates.find(
      (item) => item.candidate.id === body.candidateId,
    );
    if (!candidate) {
      return json(
        { error: "That reconciliation candidate is no longer current." },
        { status: 409 },
      );
    }
    const canonicalObservationId = body.canonicalObservationId;
    if (
      canonicalObservationId &&
      !candidate.candidate.memberIds.includes(canonicalObservationId)
    ) {
      return json(
        { error: "The canonical record must belong to this candidate." },
        { status: 400 },
      );
    }
    if (
      body.state === "confirmed" &&
      !canonicalObservationId &&
      !candidate.candidate.recommendedCanonicalId
    ) {
      return json(
        { error: "Choose the record that should provide canonical fields." },
        { status: 400 },
      );
    }
    await serverReconciliations().save(params.id, {
      candidateId: body.candidateId,
      state: body.state,
      canonicalObservationId,
      updatedAt: new Date().toISOString(),
    });
    return json(compactReconciliationReview(await review(params.id)));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
