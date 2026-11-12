import { json } from "@sveltejs/kit";
import {
  LEDGER_CHAT_SESSION_ID,
  normalizeLedgerChatSession,
  proposalForId,
  withProposalStatus,
} from "$lib/ai/chat";
import { validateLedgerProposal } from "$lib/server/ai-ledger";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function PATCH({
  params,
  request,
}: {
  params: { id: string; proposalId: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    if (body?.action !== "keep" && body?.action !== "undo") {
      return json({ error: "Choose keep or undo." }, { status: 400 });
    }
    const workspace = await serverWorkspace();
    const stored = await workspace.readAiSession(
      params.id,
      LEDGER_CHAT_SESSION_ID,
    );
    const session = normalizeLedgerChatSession(stored?.session);
    const proposal = proposalForId(session, params.proposalId);
    if (!proposal)
      return json({ error: "Ledger proposal not found." }, { status: 404 });
    if ((proposal.status ?? "pending") !== "pending") {
      return json(
        { error: "This ledger proposal has already been resolved." },
        { status: 409 },
      );
    }
    if (body.action === "undo") {
      const next = withProposalStatus(session, proposal.id, "undone");
      await workspace.writeAiSession(params.id, {
        projectId: params.id,
        sessionId: LEDGER_CHAT_SESSION_ID,
        session: next,
        updatedAt: next.updatedAt,
      });
      return json({ session: next });
    }

    const snapshot = await workspace.readProject(params.id);
    const currentRevision = snapshot.revisions.find(
      (item) => item.path === proposal.file.path,
    )?.revision;
    if (currentRevision !== proposal.file.revision) {
      const stale = withProposalStatus(session, proposal.id, "stale");
      await workspace.writeAiSession(params.id, {
        projectId: params.id,
        sessionId: LEDGER_CHAT_SESSION_ID,
        session: stale,
        updatedAt: stale.updatedAt,
      });
      return json(
        {
          error: "Ledger source changed; review a new proposal.",
          session: stale,
        },
        { status: 409 },
      );
    }
    const validated = validateLedgerProposal(snapshot, proposal);
    if (validated.errors.length) {
      return json(
        {
          error: `Proposal would introduce ledger errors: ${validated.errors.join("; ")}`,
        },
        { status: 400 },
      );
    }
    await workspace.writeFile(
      params.id,
      { path: proposal.file.path, contents: validated.contents },
      { expectedRevision: proposal.file.revision },
    );
    const next = withProposalStatus(session, proposal.id, "kept");
    await workspace.writeAiSession(params.id, {
      projectId: params.id,
      sessionId: LEDGER_CHAT_SESSION_ID,
      session: next,
      updatedAt: next.updatedAt,
    });
    return json({
      session: next,
      snapshot: await workspace.readProject(params.id),
    });
  } catch (error) {
    const text = message(error);
    return json(
      { error: text },
      { status: text.includes("changed since") ? 409 : 400 },
    );
  }
}
