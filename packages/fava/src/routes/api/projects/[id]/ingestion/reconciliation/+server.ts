import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  autoConfirmableMappedOverlaps,
  buildReconciliationReview,
  confirmedProposalReconciliations,
} from "@beancount-js/server";
import {
  compactConfirmedProposalReconciliations,
  compactReconciliationReview,
} from "$lib/reconciliation-review-response";
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

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const result = await review(params.id);
    if (url.searchParams.get("summary") === "count") {
      return json({ count: result.candidates.length });
    }
    if (url.searchParams.get("summary") === "proposal-reconciliations") {
      return json(
        compactConfirmedProposalReconciliations(
          confirmedProposalReconciliations(result),
        ),
      );
    }
    return json(compactReconciliationReview(result));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}

/** Confirm only the unambiguous mapped-source subset; applying remains manual. */
export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    if (!body || body.action !== "auto-confirm") {
      return json(
        { error: "action auto-confirm is required." },
        { status: 400 },
      );
    }
    const current = await review(params.id);
    const candidates = autoConfirmableMappedOverlaps(current);
    const reconciliations = serverReconciliations();
    const updatedAt = new Date().toISOString();
    await Promise.all(
      candidates.map((item) =>
        reconciliations.save(params.id, {
          candidateId: item.candidate.id,
          state: "confirmed",
          canonicalObservationId: item.candidate.recommendedCanonicalId,
          updatedAt,
        }),
      ),
    );
    return json({
      confirmedCandidateIds: candidates.map((item) => item.candidate.id),
      review: compactReconciliationReview(await review(params.id)),
    });
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

/** Clear a confirmed decision without dismissing the underlying candidate. */
export async function DELETE({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    if (!body || typeof body.candidateId !== "string") {
      return json({ error: "candidateId is required." }, { status: 400 });
    }
    const current = await review(params.id);
    const candidate = current.candidates.find(
      (item) => item.candidate.id === body.candidateId,
    );
    if (candidate?.decision?.state !== "confirmed") {
      return json(
        { error: "That reconciliation is not currently confirmed." },
        { status: 409 },
      );
    }
    await serverReconciliations().remove(params.id, body.candidateId);
    return json(compactReconciliationReview(await review(params.id)));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
