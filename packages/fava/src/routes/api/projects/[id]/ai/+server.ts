import { json } from "@sveltejs/kit";
import { askCodexAboutLedger } from "@beancount-js/server";
import type { AiSessionRecord } from "@beancount-js/workspace";
import { serverWorkspace } from "$lib/server/workspace";

type ChatSession = {
  provider: "codex";
  messages: Array<{ role: "user" | "assistant"; text: string }>;
};

function ledgerContext(files: Array<{ path: string; contents: string }>) {
  return files
    .filter((file) => /\.(bean|beancount|ledger)$/i.test(file.path))
    .map((file) => `--- ${file.path} ---\n${file.contents}`)
    .join("\n\n")
    .slice(0, 180_000);
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const {
    question,
    sessionId = crypto.randomUUID(),
    model,
    context,
  } = await request.json();
  if (typeof question !== "string" || !question.trim()) {
    return json({ error: "A question is required." }, { status: 400 });
  }
  const workspace = await serverWorkspace();
  const snapshot = await workspace.readProject(params.id);
  const selected =
    context &&
    typeof context === "object" &&
    typeof (context as { path?: unknown }).path === "string" &&
    snapshot.ledgerFiles.some(
      (file) => file.path === (context as { path: string }).path,
    )
      ? context
      : undefined;
  const previous = (await workspace.readAiSession(
    params.id,
    sessionId,
  )) as AiSessionRecord<ChatSession> | null;
  const history =
    previous?.session.messages
      .slice(-6)
      .map((message) => `${message.role}: ${message.text}`)
      .join("\n") ?? "";
  const answer = await askCodexAboutLedger({
    cwd: snapshot.project.root ?? process.cwd(),
    model: typeof model === "string" ? model : undefined,
    prompt: `You are Beancount Studio's account-state assistant. Answer only from the bounded ledger snapshot below. Do not suggest commands, edits, or actions. If data is insufficient, say so plainly.\n\nConversation:\n${history}\n\nQuestion: ${question}\n\n${selected ? `Selected source context: ${JSON.stringify(selected)}\n\n` : ""}Ledger snapshot:\n${ledgerContext(snapshot.ledgerFiles)}`,
  });
  const session: AiSessionRecord<ChatSession> = {
    projectId: params.id,
    sessionId,
    updatedAt: new Date().toISOString(),
    session: {
      provider: "codex",
      messages: [
        ...(previous?.session.messages ?? []),
        { role: "user", text: question },
        { role: "assistant", text: answer },
      ],
    },
  };
  await workspace.writeAiSession(params.id, session);
  return json({ sessionId, answer });
}
