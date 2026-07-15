import type { AgentEvent, ApprovalRequest, ApprovalResponse } from "./agent";

export type AppServerMessage = {
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string; code?: number; data?: unknown } | unknown;
};

type JsonObject = Record<string, unknown>;

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  const candidate = record(value);
  for (const key of ["text", "delta", "content", "message", "value"]) {
    if (typeof candidate[key] === "string") return candidate[key] as string;
  }
  return "";
}

function item(params: JsonObject) {
  return record(params.item);
}

function turnId(params: JsonObject) {
  return typeof params.turnId === "string" ? params.turnId : undefined;
}

function toolName(value: JsonObject) {
  return String(
    value.tool ?? value.command ?? value.name ?? value.type ?? "tool",
  );
}

function isTool(value: JsonObject) {
  return (
    value.type === "mcpToolCall" ||
    value.type === "dynamicToolCall" ||
    value.type === "commandExecution"
  );
}

function errorText(value: unknown): string {
  const valueRecord = record(value);
  if (typeof valueRecord.message === "string") return valueRecord.message;
  if (typeof valueRecord.error === "string") return valueRecord.error;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Map the public Codex app-server notifications into UI-agnostic events. */
export function mapCodexNotification(message: AppServerMessage): AgentEvent[] {
  const params = record(message.params);
  const activeTurnId = turnId(params);

  switch (message.method) {
    case "item/agentMessage/delta":
      return [
        {
          type: "output_delta",
          text: text(params.delta),
          itemId: typeof params.itemId === "string" ? params.itemId : undefined,
          turnId: activeTurnId,
        },
      ];
    case "item/reasoning/textDelta":
    case "item/reasoning/summaryTextDelta":
    case "item/plan/delta":
      return [
        {
          type: "reasoning_delta",
          text: text(params.delta ?? params.text),
          itemId: typeof params.itemId === "string" ? params.itemId : undefined,
          turnId: activeTurnId,
          kind:
            message.method === "item/plan/delta"
              ? "plan"
              : message.method === "item/reasoning/summaryTextDelta"
                ? "summary"
                : "reasoning",
        },
      ];
    case "item/started": {
      const started = item(params);
      if (!isTool(started)) return [];
      return [
        {
          type: "tool_call_started",
          id: String(started.id ?? params.itemId ?? "tool"),
          name: toolName(started),
          server:
            typeof started.server === "string" ? started.server : undefined,
          arguments: started.arguments,
          turnId: activeTurnId,
        },
      ];
    }
    case "item/completed": {
      const completed = item(params);
      if (completed.type === "agentMessage") {
        return [
          {
            type: "message",
            text: text(completed.text),
            itemId: typeof completed.id === "string" ? completed.id : undefined,
            turnId: activeTurnId,
          },
        ];
      }
      if (!isTool(completed)) return [];
      return [
        {
          type: "tool_call_completed",
          id: String(completed.id ?? params.itemId ?? "tool"),
          name: toolName(completed),
          server:
            typeof completed.server === "string" ? completed.server : undefined,
          result:
            completed.result ??
            completed.aggregatedOutput ??
            completed.contentItems,
          error: completed.error,
          turnId: activeTurnId,
        },
      ];
    }
    case "turn/completed": {
      const completedTurn = record(params.turn);
      return [
        {
          type: "done",
          turnId:
            typeof completedTurn.id === "string"
              ? completedTurn.id
              : activeTurnId,
          status:
            typeof completedTurn.status === "string"
              ? completedTurn.status
              : undefined,
        },
      ];
    }
    case "warning":
    case "guardianWarning":
    case "configWarning":
    case "deprecationNotice":
      return [{ type: "message", text: errorText(params), level: "warning" }];
    case "error":
      return [
        {
          type: "error",
          message: errorText(params.message ?? params.error ?? params),
          error: params,
        },
      ];
    default:
      return [];
  }
}

function decision(
  response: ApprovalResponse,
  accepted: string,
  declined: string,
  cancelled = declined,
) {
  if (response.decision === "approve") return { decision: accepted };
  if (response.decision === "cancel") return { decision: cancelled };
  return { decision: declined };
}

export function approvalRequestFromServerRequest(
  message: AppServerMessage,
): ApprovalRequest | null {
  if (message.id === undefined || !message.method) return null;
  const params = record(message.params);
  const base = {
    id: message.id,
    reason: typeof params.reason === "string" ? params.reason : null,
    details: params,
  };

  switch (message.method) {
    case "item/commandExecution/requestApproval":
      return {
        ...base,
        kind: "command",
        command:
          typeof params.command === "string" || Array.isArray(params.command)
            ? (params.command as string | string[])
            : null,
        cwd: typeof params.cwd === "string" ? params.cwd : null,
      };
    case "item/fileChange/requestApproval":
      return { ...base, kind: "file_change" };
    case "item/permissions/requestApproval":
      return {
        ...base,
        kind: "permissions",
        cwd: typeof params.cwd === "string" ? params.cwd : null,
      };
    case "applyPatchApproval":
      return { ...base, kind: "apply_patch" };
    case "mcpServer/elicitation/request":
      return { ...base, kind: "mcp_elicitation" };
    case "item/tool/requestUserInput":
      return { ...base, kind: "user_input" };
    default:
      return null;
  }
}

export function approvalResponseResultForServerRequest(
  message: AppServerMessage,
  response: ApprovalResponse,
) {
  switch (message.method) {
    case "item/commandExecution/requestApproval":
    case "item/fileChange/requestApproval":
      return decision(response, "accept", "decline", "cancel");
    case "item/permissions/requestApproval":
      if (response.decision !== "approve")
        throw new Error("Permission approval was not granted.");
      return { scope: response.scope ?? "turn" };
    case "applyPatchApproval":
      return decision(response, "approved", "denied", "abort");
    case "mcpServer/elicitation/request":
      return {
        action:
          response.decision === "approve"
            ? "accept"
            : response.decision === "cancel"
              ? "cancel"
              : "decline",
        content:
          response.decision === "approve" ? (response.content ?? {}) : null,
        _meta: response.decision === "approve" ? (response.meta ?? {}) : null,
      };
    default:
      throw new Error(
        `Unsupported approval request: ${String(message.method)}`,
      );
  }
}

/** Beancount's MCP tools are read-only or return review-only proposals. */
export function autoApprovalResultForServerRequest(message: AppServerMessage) {
  if (message.method !== "mcpServer/elicitation/request") return null;
  const params = record(message.params);
  if (params.serverName !== "beancount_studio") return null;
  return {
    action: "accept",
    content: {},
    _meta: { approvedBy: "beancount-studio-safe-ledger-tools" },
  };
}
