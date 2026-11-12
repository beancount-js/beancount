import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CodexProvider,
  type AgentEvent,
  type AgentSession,
  type McpServerConfig,
} from "@beancount-js/server";
import type { ProjectSnapshot } from "@beancount-js/workspace";

export type ActiveLedgerAiSession = {
  projectId: string;
  model: string;
  session: AgentSession;
  iterator: AsyncIterator<AgentEvent>;
  busy: boolean;
  pendingRequestId: string | number | null;
};

const activeSessions = new Map<string, ActiveLedgerAiSession>();
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function beancountMcpServer(
  projectId: string,
  activePath?: string,
): McpServerConfig {
  return {
    name: "beancount_studio",
    command: "pnpm",
    args: [
      "--filter",
      "@beancount-js/app",
      "ai:mcp",
      "--",
      "--project-id",
      projectId,
      "--session-id",
      "ledger",
      ...(activePath ? ["--active-path", activePath] : []),
    ],
    cwd: appRoot,
    enabledTools: [
      "ledger_list_sources",
      "ledger_read",
      "ledger_search",
      "ledger_query",
      "ledger_propose_change",
    ],
    defaultToolsApprovalMode: "auto",
    required: true,
  };
}

export async function activeLedgerAiSession(
  snapshot: ProjectSnapshot,
  model: string,
  activePath?: string,
) {
  const current = activeSessions.get(snapshot.project.id);
  if (current && current.model === model) return current;
  if (current) await disposeLedgerAiSession(snapshot.project.id);

  const provider = new CodexProvider();
  const session = await provider.startSession({
    cwd: snapshot.project.root ?? process.cwd(),
    model: model || undefined,
    mcpServers: [beancountMcpServer(snapshot.project.id, activePath)],
  });
  const active: ActiveLedgerAiSession = {
    projectId: snapshot.project.id,
    model,
    session,
    iterator: session.events[Symbol.asyncIterator](),
    busy: false,
    pendingRequestId: null,
  };
  activeSessions.set(snapshot.project.id, active);
  return active;
}

export function getActiveLedgerAiSession(projectId: string) {
  return activeSessions.get(projectId) ?? null;
}

export async function disposeLedgerAiSession(projectId: string) {
  const active = activeSessions.get(projectId);
  if (!active) return;
  activeSessions.delete(projectId);
  active.pendingRequestId = null;
  await active.session.dispose().catch(() => {});
}

export async function withActiveLedgerAiSession<T>(
  active: ActiveLedgerAiSession,
  action: (active: ActiveLedgerAiSession) => Promise<T>,
) {
  if (active.busy)
    throw new Error("The ledger assistant is already handling a request.");
  active.busy = true;
  try {
    return await action(active);
  } finally {
    active.busy = false;
  }
}

export function ledgerAgentPrompt(input: {
  prompt: string;
  selected?: {
    path: string;
    text?: string;
    fromLine?: number;
    toLine?: number;
  };
  attachments?: string[];
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  const selected = input.selected
    ? `\nSelected editor context: ${input.selected.path}${input.selected.fromLine ? ` lines ${input.selected.fromLine}-${input.selected.toLine ?? input.selected.fromLine}` : ""}.\n${input.selected.text ? input.selected.text.slice(0, 4_000) : ""}`
    : "";
  const attachments = input.attachments?.length
    ? `\nThe user mentioned these ledger files: ${input.attachments.join(", ")}. Read them with the ledger tools when useful.`
    : "";
  const history = input.history?.length
    ? `\nRecent conversation for continuity:\n${input.history
        .slice(-8)
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n")}`
    : "";
  return `You are Beancount Studio's ledger assistant. Use only the beancount_studio MCP tools to inspect project data. Do not use shell commands, filesystem access, apps, web access, or any tool outside that MCP server. Explain findings clearly and mention source paths when material.

For any requested edit, call ledger_propose_change instead of writing a file. A proposal is review-only: the user must keep it before it is applied. Use unique replacement blocks, preserve Beancount formatting, and do not propose a change that introduces validation errors. There can be only one pending proposal at a time.
${history}${selected}${attachments}

User request: ${input.prompt}`;
}
