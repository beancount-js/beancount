import type { ProjectSnapshot } from "@beancount-js/workspace";
import type { AgentEvent } from "@beancount-js/server";
import {
  applyAgentEvent,
  newLedgerChatSession,
  proposalForId,
  withProposalStatus,
  type LedgerChatSession,
  type LedgerPatchProposal,
} from "../../src/domain/lib/ai/chat";
import { NOW } from "../fixtures/project";
export function createAiServices(
  read: (id: string) => ProjectSnapshot,
  save: (
    id: string,
    path: string,
    contents: string,
    revision?: string,
  ) => Promise<ProjectSnapshot>,
) {
  const sessions = new Map<string, LedgerChatSession>();
  let sequence = 0;
  function fresh() {
    return { ...newLedgerChatSession(), updatedAt: NOW };
  }
  return {
    async request(input: string, init: RequestInit = {}) {
      if (init.signal?.aborted) throw init.signal.reason;
      const url = new URL(input, "http://fixture.invalid");
      const parts = url.pathname.split("/").map(decodeURIComponent);
      const id = parts[3]!;
      const path = parts.slice(5);
      const project = read(id);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      const method = init.method ?? "GET";
      let session = sessions.get(id) ?? fresh();
      if (path[0] === "files")
        return Response.json({
          files: project.ledgerFiles
            .filter((file) =>
              file.path.includes(url.searchParams.get("query") ?? ""),
            )
            .map(({ path }) => ({ path })),
        });
      if (path[0] === "proposals") {
        const proposal = proposalForId(session, path[1]!);
        if (!proposal || proposal.status !== "pending")
          return Response.json(
            { error: "Pending proposal not found" },
            { status: 404 },
          );
        let snapshot: ProjectSnapshot | undefined;
        if (body.action === "keep") {
          const file = project.ledgerFiles.find(
            (file) => file.path === proposal.file.path,
          )!;
          if (
            project.revisions.find((r) => r.path === file.path)?.revision !==
            proposal.file.revision
          ) {
            session = withProposalStatus(session, proposal.id, "stale");
            sessions.set(id, session);
            return Response.json(
              { error: "The ledger changed. Request a new proposal." },
              { status: 409 },
            );
          }
          let contents = file.contents;
          for (const replacement of proposal.replacements) {
            if (!contents.includes(replacement.oldText))
              return Response.json(
                { error: "Proposal text is stale" },
                { status: 409 },
              );
            contents = contents.replace(
              replacement.oldText,
              replacement.newText,
            );
          }
          snapshot = await save(
            id,
            file.path,
            contents,
            proposal.file.revision,
          );
          session = withProposalStatus(session, proposal.id, "kept");
        } else if (body.action === "undo")
          session = withProposalStatus(session, proposal.id, "undone");
        else
          return Response.json(
            { error: "Choose keep or undo" },
            { status: 400 },
          );
        session.updatedAt = NOW;
        sessions.set(id, session);
        return Response.json({ session, snapshot });
      }
      if (path[0] === "respond")
        return Response.json(
          {
            error: "There is no pending tool approval in this catalog session.",
          },
          { status: 409 },
        );
      if (method === "DELETE") session = fresh();
      if (method === "PUT") session = { ...session, model: body.model ?? "" };
      if (method === "POST") {
        const file = project.ledgerFiles.find(
          (file) => file.path === project.project.entryFile,
        )!;
        const oldText = file.contents.split("\n")[0]!;
        const proposal: LedgerPatchProposal = {
          id: `proposal-${++sequence}`,
          kind: "ledger",
          title: "Clarify ledger title",
          file: {
            path: file.path,
            revision: project.revisions.find((r) => r.path === file.path)!
              .revision,
          },
          replacements: [
            { oldText, newText: oldText.replace(/"$/, ' · reviewed"') },
          ],
          valid: true,
          status: "pending",
        };
        session = {
          ...session,
          messages: [...session.messages, { role: "user", text: body.prompt }],
          items: [
            ...session.items,
            {
              id: `user-${sequence}`,
              type: "message",
              role: "user",
              text: body.prompt,
            },
          ],
        };
        const events: AgentEvent[] = [
          {
            type: "reasoning_delta",
            kind: "plan",
            text: "Inspect the selected ledger and prepare a change for review.",
          },
          { type: "output_delta", text: "I prepared a title clarification. " },
          {
            type: "output_delta",
            text: "Review the diff below; the ledger changes only when you keep it.",
          },
          {
            type: "tool_call_started",
            id: `tool-${sequence}`,
            name: "ledger_propose_change",
            arguments: { path: file.path },
          },
          {
            type: "tool_call_completed",
            id: `tool-${sequence}`,
            name: "ledger_propose_change",
            result: proposal,
          },
          { type: "done", status: "completed" },
        ];
        for (const event of events) session = applyAgentEvent(session, event);
        session.updatedAt = NOW;
        sessions.set(id, session);
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  events.map((event) => JSON.stringify(event)).join("\n") +
                    "\n",
                ),
              );
              controller.close();
            },
          }),
          { headers: { "content-type": "application/x-ndjson" } },
        );
      }
      sessions.set(id, session);
      return Response.json({ session });
    },
  };
}
