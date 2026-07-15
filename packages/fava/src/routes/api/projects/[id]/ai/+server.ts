import { json } from "@sveltejs/kit";
import type { AgentEvent, ApprovalResponse } from "@beancount-js/server";
import type { AiSessionRecord, ProjectSnapshot } from "@beancount-js/workspace";
import {
  applyAgentEvent,
  LEDGER_CHAT_SESSION_ID,
  newLedgerChatSession,
  normalizeLedgerChatSession,
  type AiChatItem,
  type AiChatMessage,
  type LedgerChatSession,
} from "$lib/ai/chat";
import {
  activeLedgerAiSession,
  disposeLedgerAiSession,
  getActiveLedgerAiSession,
  ledgerAgentPrompt,
  withActiveLedgerAiSession,
} from "$lib/server/ai";
import { serverWorkspace } from "$lib/server/workspace";

const MODEL_OPTIONS = new Set([
  "",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex-spark",
]);
const encoder = new TextEncoder();

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function validModel(value: unknown) {
  return typeof value === "string" && MODEL_OPTIONS.has(value) ? value : null;
}

function selectedContext(value: unknown, snapshot: ProjectSnapshot) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const context = value as Record<string, unknown>;
  if (
    typeof context.path !== "string" ||
    !snapshot.ledgerFiles.some((file) => file.path === context.path)
  ) {
    return undefined;
  }
  return {
    path: context.path,
    ...(typeof context.text === "string"
      ? { text: context.text.slice(0, 4_000) }
      : {}),
    ...(typeof context.fromLine === "number"
      ? { fromLine: context.fromLine }
      : {}),
    ...(typeof context.toLine === "number" ? { toLine: context.toLine } : {}),
  };
}

function attachments(value: unknown, snapshot: ProjectSnapshot) {
  if (!Array.isArray(value)) return [];
  const paths = new Set(snapshot.ledgerFiles.map((file) => file.path));
  return value
    .filter(
      (path): path is string => typeof path === "string" && paths.has(path),
    )
    .slice(0, 8);
}

async function chatSession(projectId: string, title: string) {
  const workspace = await serverWorkspace();
  const stored = (await workspace.readAiSession(
    projectId,
    LEDGER_CHAT_SESSION_ID,
  )) as AiSessionRecord | null;
  return {
    workspace,
    session: stored
      ? normalizeLedgerChatSession(stored.session, title)
      : newLedgerChatSession("", title),
  };
}

async function saveSession(projectId: string, session: LedgerChatSession) {
  const workspace = await serverWorkspace();
  const record: AiSessionRecord<LedgerChatSession> = {
    projectId,
    sessionId: LEDGER_CHAT_SESSION_ID,
    session,
    updatedAt: session.updatedAt,
  };
  await workspace.writeAiSession(projectId, record);
}

function markStaleProposals(
  session: LedgerChatSession,
  snapshot: ProjectSnapshot,
) {
  let changed = false;
  const revisions = new Map(
    snapshot.revisions.map((revision) => [revision.path, revision.revision]),
  );
  const items = session.items.map((item) => {
    if (
      item.type !== "proposal" ||
      (item.proposal.status ?? "pending") !== "pending"
    )
      return item;
    if (revisions.get(item.proposal.file.path) === item.proposal.file.revision)
      return item;
    changed = true;
    return {
      ...item,
      proposal: { ...item.proposal, status: "stale" as const },
    };
  });
  return changed
    ? { ...session, items, updatedAt: new Date().toISOString() }
    : session;
}

async function streamEvents(input: {
  projectId: string;
  session: LedgerChatSession;
  active: Awaited<ReturnType<typeof activeLedgerAiSession>>;
  controller: ReadableStreamDefaultController<Uint8Array>;
}) {
  let session = input.session;
  while (true) {
    const next = await input.active.iterator.next();
    if (next.done) return;
    const event = next.value as AgentEvent;
    if (event.type === "approval_requested")
      input.active.pendingRequestId = event.request.id;
    session = applyAgentEvent(session, event);
    await saveSession(input.projectId, session);
    input.controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    if (
      event.type === "done" ||
      event.type === "error" ||
      event.type === "approval_requested"
    )
      return;
  }
}

export async function GET({ params }: { params: { id: string } }) {
  try {
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const loaded = await chatSession(
      params.id,
      `AI · ${snapshot.project.name}`,
    );
    const session = markStaleProposals(loaded.session, snapshot);
    if (session !== loaded.session) await saveSession(params.id, session);
    return json({ session });
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
    const model = validModel(body?.model);
    if (model === null)
      return json({ error: "Unsupported Codex model." }, { status: 400 });
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const loaded = await chatSession(
      params.id,
      `AI · ${snapshot.project.name}`,
    );
    const session = {
      ...loaded.session,
      model,
      updatedAt: new Date().toISOString(),
    };
    await saveSession(params.id, session);
    const active = getActiveLedgerAiSession(params.id);
    if (active && !active.busy && active.model !== model)
      await disposeLedgerAiSession(params.id);
    return json({ session });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}

export async function DELETE({ params }: { params: { id: string } }) {
  try {
    const active = getActiveLedgerAiSession(params.id);
    if (active?.busy)
      return json(
        { error: "Wait for the current AI turn to finish before clearing it." },
        { status: 409 },
      );
    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    await disposeLedgerAiSession(params.id);
    const session = newLedgerChatSession("", `AI · ${snapshot.project.name}`);
    await saveSession(params.id, session);
    return json({ session });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  let snapshot: ProjectSnapshot;
  let session: LedgerChatSession;
  let prompt: string;
  let context: ReturnType<typeof selectedContext>;
  let mentioned: string[];
  try {
    const body = await request.json();
    prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : typeof body?.question === "string"
          ? body.question.trim()
          : "";
    if (!prompt)
      return json({ error: "A prompt is required." }, { status: 400 });
    const requestedModel =
      body?.model === undefined ? undefined : validModel(body.model);
    if (requestedModel === null)
      return json({ error: "Unsupported Codex model." }, { status: 400 });
    const workspace = await serverWorkspace();
    snapshot = await workspace.readProject(params.id);
    const loaded = await chatSession(
      params.id,
      `AI · ${snapshot.project.name}`,
    );
    session = markStaleProposals(loaded.session, snapshot);
    if (requestedModel !== undefined)
      session = { ...session, model: requestedModel };
    context = selectedContext(body?.context, snapshot);
    mentioned = attachments(body?.attachments, snapshot);
    const userMessage: AiChatMessage = { role: "user", text: prompt };
    const userItem: AiChatItem = {
      id: `user-${crypto.randomUUID()}`,
      type: "message",
      role: "user",
      text: prompt,
    };
    session = {
      ...session,
      messages: [...session.messages, userMessage].slice(-40),
      items: [...session.items, userItem].slice(-100),
      updatedAt: new Date().toISOString(),
      interrupted: false,
    };
    await saveSession(params.id, session);
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const previousActive = getActiveLedgerAiSession(params.id);
          const active = await activeLedgerAiSession(
            snapshot,
            session.model,
            context?.path,
          );
          await withActiveLedgerAiSession(active, async () => {
            await active.session.send(
              ledgerAgentPrompt({
                prompt,
                selected: context,
                attachments: mentioned,
                history: previousActive
                  ? undefined
                  : session.messages.slice(0, -1),
              }),
            );
            await streamEvents({
              projectId: params.id,
              session,
              active,
              controller,
            });
          });
        } catch (error) {
          const event: AgentEvent = { type: "error", message: message(error) };
          const next = applyAgentEvent(session, event);
          await saveSession(params.id, next).catch(() => {});
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } finally {
          controller.close();
        }
      },
      async cancel() {
        await getActiveLedgerAiSession(params.id)?.session.cancel();
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
