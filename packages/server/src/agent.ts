export type AgentProviderName = "codex";

export type McpServerConfig = {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  enabledTools?: string[];
  defaultToolsApprovalMode?: "auto" | "prompt" | "approve";
  required?: boolean;
};

export type ApprovalRequest = {
  id: string | number;
  kind:
    | "command"
    | "file_change"
    | "permissions"
    | "apply_patch"
    | "mcp_elicitation"
    | "user_input";
  reason?: string | null;
  command?: string | string[] | null;
  cwd?: string | null;
  details?: unknown;
};

export type ApprovalResponse = {
  decision: "approve" | "reject" | "cancel";
  scope?: "turn" | "session";
  content?: unknown;
  meta?: unknown;
};

export type AgentEvent =
  | {
      type: "session_started";
      provider: AgentProviderName;
      sessionId: string;
      threadId?: string;
    }
  | { type: "output_delta"; text: string; itemId?: string; turnId?: string }
  | {
      type: "reasoning_delta";
      text: string;
      itemId?: string;
      turnId?: string;
      kind?: "reasoning" | "summary" | "plan";
    }
  | {
      type: "message";
      text: string;
      itemId?: string;
      turnId?: string;
      level?: "info" | "warning";
    }
  | {
      type: "tool_call_started";
      id: string;
      name: string;
      server?: string;
      arguments?: unknown;
      turnId?: string;
    }
  | {
      type: "tool_call_completed";
      id: string;
      name: string;
      server?: string;
      result?: unknown;
      error?: unknown;
      turnId?: string;
    }
  | { type: "approval_requested"; request: ApprovalRequest }
  | { type: "error"; message: string; error?: unknown }
  | { type: "done"; turnId?: string; status?: string };

export type AgentInput = {
  cwd: string;
  model?: string;
  mcpServers?: McpServerConfig[];
};

export type AgentSession = {
  id: string;
  events: AsyncIterable<AgentEvent>;
  send(prompt: string): Promise<void>;
  respondToRequest(
    requestId: string | number,
    response: ApprovalResponse,
  ): Promise<void>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
};

export type AgentProvider = {
  name: AgentProviderName;
  startSession(input: AgentInput): Promise<AgentSession>;
};
