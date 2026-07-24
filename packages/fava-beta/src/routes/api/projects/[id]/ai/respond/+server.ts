import { json } from "@sveltejs/kit";
import type { AgentEvent, ApprovalResponse } from "@beancount-js/server";
import {
  applyAgentEvent,
  LEDGER_CHAT_SESSION_ID,
  normalizeLedgerChatSession,
  type LedgerChatSession,
} from "$lib/ai/chat";
import {
  getActiveLedgerAiSession,
  withActiveLedgerAiSession,
} from "$lib/server/ai";
import { serverWorkspace } from "$lib/server/workspace";

const encoder = new TextEncoder();

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function save(projectId: string, session: LedgerChatSession) {
  const workspace = await serverWorkspace();
  await workspace.writeAiSession(projectId, {
    projectId,
    sessionId: LEDGER_CHAT_SESSION_ID,
    session,
    updatedAt: session.updatedAt,
  });
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  let active = getActiveLedgerAiSession(params.id);
  let requestId: string | number;
  let response: ApprovalResponse;
  let session: LedgerChatSession;
  try {
    const body = await request.json();
    requestId = body?.requestId;
    if (typeof requestId !== "string" && typeof requestId !== "number")
      throw new Error("requestId is required.");
    if (!["approve", "reject", "cancel"].includes(body?.decision))
      throw new Error("A valid decision is required.");
    response = { decision: body.decision };
    if (
      !active ||
      active.pendingRequestId === null ||
      String(active.pendingRequestId) !== String(requestId)
    ) {
      throw new Error("That AI approval request is no longer pending.");
    }
    const workspace = await serverWorkspace();
    const stored = await workspace.readAiSession(
      params.id,
      LEDGER_CHAT_SESSION_ID,
    );
    session = normalizeLedgerChatSession(stored?.session);
  } catch (error) {
    return json({ error: message(error) }, { status: 409 });
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          await withActiveLedgerAiSession(active!, async (current) => {
            current.pendingRequestId = null;
            await current.session.respondToRequest(requestId, response);
            while (true) {
              const next = await current.iterator.next();
              if (next.done) return;
              const event = next.value as AgentEvent;
              if (event.type === "approval_requested")
                current.pendingRequestId = event.request.id;
              session = applyAgentEvent(session, event);
              await save(params.id, session);
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
              if (
                event.type === "done" ||
                event.type === "error" ||
                event.type === "approval_requested"
              )
                return;
            }
          });
        } catch (error) {
          const event: AgentEvent = { type: "error", message: message(error) };
          session = applyAgentEvent(session, event);
          await save(params.id, session).catch(() => {});
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "content-type": "application/x-ndjson",
        "cache-control": "no-store",
      },
    },
  );
}
