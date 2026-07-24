import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  proposalIsReadyForAcceptance,
  proposalTransaction,
} from "@beancount-js/beangulp";
import {
  buildReconciliationReview,
  ensureProposalsMerchantsPersisted,
} from "@beancount-js/server";
import { serverIngestion, serverReconciliations } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorMessages(errors: readonly { message: string }[]) {
  return new Set(errors.map((error) => error.message));
}

export async function POST({
  params,
  request,
}: {
  params: { id: string; runId: string };
  request: Request;
}) {
  try {
    const { proposalIds, expectedRevision } = await request.json();
    if (
      !Array.isArray(proposalIds) ||
      !proposalIds.every((id) => typeof id === "string")
    ) {
      return json({ error: "proposalIds must be an array." }, { status: 400 });
    }
    if (typeof expectedRevision !== "string") {
      return json(
        { error: "expectedRevision is required to accept imports." },
        { status: 400 },
      );
    }

    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const store = serverIngestion();
    const run = await store.run(params.id, params.runId);
    const source = await store.sourceForRunSourceId(params.id, run.sourceId);
    const destinationPath =
      source.destinationPath ?? snapshot.project.entryFile;
    const destination = snapshot.ledgerFiles.find(
      (file) => file.path === destinationPath,
    );
    const revision = snapshot.revisions.find(
      (item) => item.path === destinationPath,
    )?.revision;
    if (!destination || !revision)
      return json(
        { error: "The configured import destination is not a ledger file." },
        { status: 400 },
      );
    if (revision !== expectedRevision)
      return json(
        { error: "Ledger changed; reload before accepting imports." },
        { status: 409 },
      );

    const selected = run.proposals.filter((proposal) =>
      proposalIds.includes(proposal.id),
    );
    if (!selected.length)
      return json(
        { error: "Select at least one proposal to accept." },
        { status: 400 },
      );
    for (const proposal of selected) {
      if (!proposalIsReadyForAcceptance(proposal)) {
        throw new Error("Only reviewed, ready proposals can be accepted.");
      }
    }
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const reconciliation = buildReconciliationReview({
      config: await store.readConfig(params.id),
      runs: await store.readRuns(params.id),
      entries,
      decisions: await serverReconciliations().read(params.id),
    });
    const selectedObservationIds = new Set(
      selected.map((proposal) => `proposal:${run.id}:${proposal.id}`),
    );
    if (
      reconciliation.candidates.some((candidate) =>
        candidate.candidate.memberIds.some((id) =>
          selectedObservationIds.has(id),
        ),
      )
    ) {
      return json(
        {
          error:
            "One or more selected imports has a reconciliation match. Confirm and apply it from Reconcile matches instead.",
        },
        { status: 409 },
      );
    }
    const persisted = await ensureProposalsMerchantsPersisted(
      store.merchants,
      params.id,
      source.id,
      selected,
    );
    const directives = persisted.map((proposal) =>
      proposalTransaction(proposal, proposal.selectedAccount!)
        .toString()
        .trim(),
    );
    const nextContents = `${destination.contents.trimEnd()}\n\n${directives.join("\n\n")}\n`;
    const sourceFiles = snapshot.ledgerFiles.map((file) =>
      file.path === destinationPath
        ? { ...file, contents: nextContents }
        : file,
    );
    const [, previousErrors] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const [, nextErrors] = loadProjectSources(
      snapshot.project.entryFile,
      sourceFiles.map((file) => ({ path: file.path, contents: file.contents })),
    );
    const knownErrors = errorMessages(previousErrors);
    const introduced = nextErrors.filter(
      (error) => !knownErrors.has(error.message),
    );
    if (introduced.length) {
      return json(
        {
          error: `Import would introduce ledger errors: ${introduced.map((error) => error.message).join("; ")}`,
        },
        { status: 400 },
      );
    }

    const written = await workspace.writeFile(
      params.id,
      { path: destinationPath, contents: nextContents },
      { expectedRevision },
    );
    await store.markAccepted(params.id, params.runId, persisted, {
      acceptedAt: new Date().toISOString(),
      destinationPath,
      ledgerRevision: written.revision,
    });
    return json({
      snapshot: await workspace.readProject(params.id),
      run: await store.run(params.id, params.runId),
    });
  } catch (error) {
    const text = message(error);
    return json(
      { error: text },
      { status: text.includes("changed since") ? 409 : 400 },
    );
  }
}
