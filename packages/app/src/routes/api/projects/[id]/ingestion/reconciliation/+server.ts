import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { summarizeIngestionProposals } from "@beancount-js/beangulp";
import {
  autoConfirmableMappedOverlaps,
  buildReconciliationReview,
  confirmedProposalReconciliations,
  recheckReviewProposal,
} from "@beancount-js/server";
import {
  compactConfirmedProposalReconciliations,
  compactReconciliationReview,
} from "$lib/reconciliation-review-response";
import { serverIngestion, serverReconciliations } from "$lib/server/ingestion";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
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

function reviewableProposalStatus(status: string) {
  return status === "ready" || status === "needs-review" || status === "held";
}

async function recheckSelectedCandidates(
  projectId: string,
  candidateIds: readonly string[],
) {
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
  const [config, runs, decisions, detectionRules] = await Promise.all([
    ingestion.readConfig(projectId),
    ingestion.readRuns(projectId),
    serverReconciliations().read(projectId),
    serverRules().listActive(projectId),
  ]);
  const current = buildReconciliationReview({
    config,
    runs,
    entries,
    decisions,
  });
  const proposalIdsByRun = new Map<string, Set<string>>();
  for (const candidateId of candidateIds) {
    const item = current.candidates.find(
      (candidate) => candidate.candidate.id === candidateId,
    );
    if (!item) {
      throw new Error("That reconciliation candidate is no longer current.");
    }
    for (const member of item.members) {
      if (!member.proposal) continue;
      const proposalIds =
        proposalIdsByRun.get(member.proposal.runId) ?? new Set<string>();
      proposalIds.add(member.proposal.proposalId);
      proposalIdsByRun.set(member.proposal.runId, proposalIds);
    }
  }

  let updatedProposalCount = 0;
  for (const run of runs) {
    const proposalIds = proposalIdsByRun.get(run.id);
    if (!proposalIds?.size) continue;
    const source = await ingestion.sourceForRunSourceId(
      projectId,
      run.sourceId,
    );
    const proposals = await Promise.all(
      run.proposals.map(async (proposal) => {
        if (
          !proposalIds.has(proposal.id) ||
          !proposal.transaction ||
          !reviewableProposalStatus(proposal.status)
        ) {
          return proposal;
        }
        updatedProposalCount += 1;
        return recheckReviewProposal(source, proposal, entries, {
          detectionRules,
        });
      }),
    );
    await ingestion.saveRun(projectId, {
      ...run,
      proposals,
      summary: summarizeIngestionProposals(proposals),
    });
  }
  return updatedProposalCount;
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
    if (!body || typeof body.action !== "string") {
      return json(
        { error: "A reconciliation action is required." },
        { status: 400 },
      );
    }
    if (body.action === "auto-confirm") {
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
    }
    const candidateIds = stringArray(body.candidateIds);
    if (
      body.action === "incremental-recheck" &&
      candidateIds &&
      candidateIds.length > 0
    ) {
      const updatedProposalCount = await recheckSelectedCandidates(
        params.id,
        candidateIds,
      );
      return json({
        updatedProposalCount,
        review: compactReconciliationReview(await review(params.id)),
      });
    }
    return json(
      { error: "A supported reconciliation action is required." },
      { status: 400 },
    );
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
