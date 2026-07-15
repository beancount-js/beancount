import type { AgentEvent } from "@beancount-js/server";

export type LedgerReplacement = { oldText: string; newText: string };
export type LedgerProposalStatus =
  | "pending"
  | "kept"
  | "undone"
  | "stale"
  | "invalid";

export type LedgerPatchProposal = {
  id: string;
  kind: "ledger";
  title: string;
  file: { path: string; revision: string };
  replacements: LedgerReplacement[];
  valid: boolean;
  errors?: string[];
  status?: LedgerProposalStatus;
};

export type AiChatMessage = { role: "user" | "assistant"; text: string };
export type AiChatTraceTool = {
  id: string;
  toolId: string;
  name: string;
  state: "running" | "completed" | "error";
  input?: string;
  output?: string;
};
export type AiChatTraceStep = {
  id: string;
  title: string;
  text?: string;
  state: "active" | "complete" | "error";
  tools?: AiChatTraceTool[];
};
export type AiChatItem =
  | { id: string; type: "message"; role: "user" | "assistant"; text: string }
  | {
      id: string;
      type: "trace";
      title: string;
      state: "streaming" | "done";
      steps: AiChatTraceStep[];
    }
  | { id: string; type: "proposal"; proposal: LedgerPatchProposal }
  | {
      id: string;
      type: "approval";
      request: { id: string | number; kind: string; reason?: string | null };
    }
  | { id: string; type: "error"; text: string };

export type LedgerChatSession = {
  version: 1;
  provider: "codex";
  model: string;
  title: string;
  messages: AiChatMessage[];
  items: AiChatItem[];
  updatedAt: string;
  interrupted?: boolean;
};

export const LEDGER_CHAT_SESSION_ID = "ledger";
export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_ITEMS = 100;

export function newLedgerChatSession(
  model = "",
  title = "Ledger assistant",
): LedgerChatSession {
  return {
    version: 1,
    provider: "codex",
    model,
    title,
    messages: [],
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeLedgerChatSession(
  value: unknown,
  title = "Ledger assistant",
): LedgerChatSession {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return newLedgerChatSession("", title);
  const session = value as Partial<LedgerChatSession>;
  return {
    version: 1,
    provider: "codex",
    model: typeof session.model === "string" ? session.model : "",
    title: typeof session.title === "string" ? session.title : title,
    messages: Array.isArray(session.messages)
      ? session.messages.filter(isChatMessage).slice(-MAX_CHAT_MESSAGES)
      : [],
    items: Array.isArray(session.items)
      ? session.items.filter(isChatItem).slice(-MAX_CHAT_ITEMS)
      : [],
    updatedAt:
      typeof session.updatedAt === "string"
        ? session.updatedAt
        : new Date().toISOString(),
    ...(session.interrupted === true ? { interrupted: true } : {}),
  };
}

function isChatMessage(value: unknown): value is AiChatMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ((value as AiChatMessage).role === "user" ||
        (value as AiChatMessage).role === "assistant") &&
      typeof (value as AiChatMessage).text === "string",
  );
}

function isProposal(value: unknown): value is LedgerPatchProposal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proposal = value as Partial<LedgerPatchProposal>;
  return (
    proposal.kind === "ledger" &&
    typeof proposal.id === "string" &&
    typeof proposal.title === "string" &&
    typeof proposal.valid === "boolean" &&
    Boolean(
      proposal.file &&
        typeof proposal.file.path === "string" &&
        typeof proposal.file.revision === "string",
    ) &&
    Array.isArray(proposal.replacements) &&
    proposal.replacements.every(
      (replacement) =>
        replacement &&
        typeof replacement.oldText === "string" &&
        typeof replacement.newText === "string",
    )
  );
}

function isChatItem(value: unknown): value is AiChatItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<AiChatItem>;
  if (typeof item.id !== "string" || typeof item.type !== "string")
    return false;
  if (item.type === "message") return isChatMessage(item);
  if (item.type === "error") return typeof item.text === "string";
  if (item.type === "proposal") return isProposal(item.proposal);
  if (item.type === "trace") return Array.isArray(item.steps);
  if (item.type === "approval")
    return Boolean(item.request && typeof item.request.id !== "undefined");
  return false;
}

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function stringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 4_000);
  try {
    return JSON.stringify(value, null, 2).slice(0, 4_000);
  } catch {
    return String(value).slice(0, 4_000);
  }
}

function appendAssistant(messages: AiChatMessage[], text: string) {
  if (!text) return messages;
  const last = messages.at(-1);
  if (last?.role === "assistant")
    return [...messages.slice(0, -1), { ...last, text: last.text + text }];
  return [...messages, { role: "assistant" as const, text }];
}

function appendAssistantItem(items: AiChatItem[], text: string) {
  if (!text) return items;
  const last = items.at(-1);
  if (last?.type === "message" && last.role === "assistant") {
    return [...items.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [
    ...items,
    {
      id: nextId("assistant"),
      type: "message" as const,
      role: "assistant" as const,
      text,
    },
  ];
}

function traceFor(items: AiChatItem[]) {
  const last = items.at(-1);
  if (last?.type === "trace" && last.state === "streaming")
    return { items, trace: last };
  const trace: Extract<AiChatItem, { type: "trace" }> = {
    id: nextId("trace"),
    type: "trace",
    title: "Working through the ledger",
    state: "streaming",
    steps: [],
  };
  return { items: [...items, trace], trace };
}

function replaceTrace(
  items: AiChatItem[],
  trace: Extract<AiChatItem, { type: "trace" }>,
) {
  return items.map((item) => (item.id === trace.id ? trace : item));
}

function eventCandidates(value: unknown, depth = 0): unknown[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    try {
      return eventCandidates(JSON.parse(value), depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value))
    return value.flatMap((item) => eventCandidates(item, depth + 1));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    value,
    ...[
      record.content,
      record.contentItems,
      record.result,
      record.output,
      record.aggregatedOutput,
      record.data,
      record.structuredContent,
    ].flatMap((item) => eventCandidates(item, depth + 1)),
  ];
}

export function proposalFromAgentEvent(event: AgentEvent) {
  if (
    event.type !== "tool_call_completed" ||
    event.name !== "ledger_propose_change"
  )
    return null;
  return eventCandidates(event.result).find(isProposal) ?? null;
}

export function hasPendingProposal(session: LedgerChatSession) {
  return session.items.some(
    (item) =>
      item.type === "proposal" &&
      (item.proposal.status ?? "pending") === "pending",
  );
}

export function proposalForId(session: LedgerChatSession, id: string) {
  const item = session.items.find(
    (candidate) =>
      candidate.type === "proposal" && candidate.proposal.id === id,
  );
  return item?.type === "proposal" ? item.proposal : null;
}

export function withProposalStatus(
  session: LedgerChatSession,
  proposalId: string,
  status: LedgerProposalStatus,
) {
  return {
    ...session,
    items: session.items.map((item) =>
      item.type === "proposal" && item.proposal.id === proposalId
        ? { ...item, proposal: { ...item.proposal, status } }
        : item,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Apply one event on both the server-persisted session and browser transcript. */
export function applyAgentEvent(
  session: LedgerChatSession,
  event: AgentEvent,
): LedgerChatSession {
  let items = session.items;
  let messages = session.messages;

  if (event.type === "output_delta") {
    messages = appendAssistant(messages, event.text);
    items = appendAssistantItem(items, event.text);
  } else if (event.type === "message") {
    if (event.level === "warning") {
      items = [
        ...items,
        { id: nextId("warning"), type: "error", text: event.text },
      ];
    } else {
      const latest = messages.at(-1);
      if (
        !latest ||
        latest.role !== "assistant" ||
        latest.text !== event.text
      ) {
        messages = appendAssistant(messages, event.text);
        items = appendAssistantItem(items, event.text);
      }
    }
  } else if (event.type === "reasoning_delta") {
    const ensured = traceFor(items);
    const trace = {
      ...ensured.trace,
      steps: [
        ...ensured.trace.steps,
        {
          id: nextId("trace-step"),
          title:
            event.kind === "plan"
              ? "Plan"
              : event.kind === "summary"
                ? "Reasoning summary"
                : "Reasoning",
          text: event.text,
          state: "complete" as const,
        },
      ],
    };
    items = replaceTrace(ensured.items, trace);
  } else if (
    event.type === "tool_call_started" ||
    event.type === "tool_call_completed"
  ) {
    const ensured = traceFor(items);
    const previousStep = ensured.trace.steps.at(-1);
    const tool: AiChatTraceTool = {
      id: nextId("trace-tool"),
      toolId: event.id,
      name: event.name,
      state:
        event.type === "tool_call_started"
          ? "running"
          : event.error
            ? "error"
            : "completed",
      ...(event.type === "tool_call_started"
        ? { input: stringify(event.arguments) }
        : { output: stringify(event.result ?? event.error) }),
    };
    const existingStep = previousStep?.tools?.some(
      (candidate) => candidate.toolId === event.id,
    )
      ? previousStep
      : undefined;
    const step: AiChatTraceStep = existingStep
      ? {
          ...existingStep,
          state:
            tool.state === "error" ? ("error" as const) : ("complete" as const),
          tools: existingStep.tools?.map((candidate) =>
            candidate.toolId === event.id
              ? {
                  ...candidate,
                  ...tool,
                  id: candidate.id,
                  input: candidate.input,
                  output: tool.output,
                }
              : candidate,
          ),
        }
      : {
          id: nextId("trace-step"),
          title: `${event.type === "tool_call_started" ? "Run" : "Ran"} ${event.name}`,
          state:
            tool.state === "error"
              ? ("error" as const)
              : event.type === "tool_call_started"
                ? ("active" as const)
                : ("complete" as const),
          tools: [tool],
        };
    const nextSteps: AiChatTraceStep[] = existingStep
      ? [...ensured.trace.steps.slice(0, -1), step]
      : [...ensured.trace.steps, step];
    items = replaceTrace(ensured.items, { ...ensured.trace, steps: nextSteps });

    const proposal = proposalFromAgentEvent(event);
    if (
      proposal &&
      proposal.valid &&
      !hasPendingProposal({ ...session, items })
    ) {
      items = [
        ...items,
        {
          id: nextId("proposal"),
          type: "proposal",
          proposal: { ...proposal, status: "pending" },
        },
      ];
    }
  } else if (event.type === "approval_requested") {
    items = [
      ...items,
      {
        id: nextId("approval"),
        type: "approval",
        request: {
          id: event.request.id,
          kind: event.request.kind,
          reason: event.request.reason,
        },
      },
    ];
  } else if (event.type === "error") {
    items = [
      ...items,
      { id: nextId("error"), type: "error", text: event.message },
    ];
  }

  if (event.type === "done" || event.type === "error") {
    items = items.map((item) =>
      item.type === "trace" && item.state === "streaming"
        ? { ...item, state: "done" as const }
        : item,
    );
  }

  return {
    ...session,
    messages: messages.slice(-MAX_CHAT_MESSAGES),
    items: items.slice(-MAX_CHAT_ITEMS),
    updatedAt: new Date().toISOString(),
    ...(event.type === "error"
      ? { interrupted: true }
      : event.type === "done"
        ? { interrupted: false }
        : {}),
  };
}

export async function readAgentEventStream(
  response: Response,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
) {
  if (!response.body) throw new Error("AI response did not include a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as AgentEvent);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AgentEvent);
}
