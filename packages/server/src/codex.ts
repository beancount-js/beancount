import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline";
import { resolve } from "node:path";
import type {
  AgentEvent,
  AgentInput,
  AgentProvider,
  AgentSession,
  ApprovalResponse,
  McpServerConfig,
} from "./agent";
import {
  approvalRequestFromServerRequest,
  approvalResponseResultForServerRequest,
  autoApprovalResultForServerRequest,
  mapCodexNotification,
  type AppServerMessage,
} from "./codex-protocol";
import { AsyncEventQueue } from "./event-queue";

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

function toml(value: unknown) {
  return JSON.stringify(value);
}

/**
 * Start Codex with no generic filesystem, shell, app, web, or multi-agent
 * capability. The only configured extension point is the supplied safe MCP
 * server, whose tools are explicitly allow-listed below.
 */
export function codexAppServerArgs(input: Pick<AgentInput, "mcpServers"> = {}) {
  const args = ["app-server", "--stdio"];
  for (const server of input.mcpServers ?? [])
    appendMcpServerArgs(args, server);
  args.push(
    "-c",
    'sandbox_mode="read-only"',
    "-c",
    'approval_policy="never"',
    "-c",
    "features.shell_tool=false",
    "-c",
    "features.apps=false",
    "-c",
    "features.multi_agent=false",
    "-c",
    'web_search="disabled"',
  );
  return args;
}

function appendMcpServerArgs(args: string[], server: McpServerConfig) {
  const prefix = `mcp_servers.${server.name}`;
  args.push("-c", `${prefix}.command=${toml(server.command)}`);
  if (server.args) args.push("-c", `${prefix}.args=${toml(server.args)}`);
  if (server.cwd) args.push("-c", `${prefix}.cwd=${toml(server.cwd)}`);
  for (const [key, value] of Object.entries(server.env ?? {})) {
    args.push("-c", `${prefix}.env.${key}=${toml(value)}`);
  }
  if (server.enabledTools) {
    args.push("-c", `${prefix}.enabled_tools=${toml(server.enabledTools)}`);
    for (const tool of server.enabledTools) {
      args.push("-c", `${prefix}.tools.${tool}.approval_mode=${toml("auto")}`);
    }
  }
  if (server.defaultToolsApprovalMode) {
    args.push(
      "-c",
      `${prefix}.default_tools_approval_mode=${toml(server.defaultToolsApprovalMode)}`,
    );
  }
  if (server.required !== undefined) {
    args.push("-c", `${prefix}.required=${server.required ? "true" : "false"}`);
  }
}

export class CodexProvider implements AgentProvider {
  readonly name = "codex" as const;

  async startSession(input: AgentInput): Promise<AgentSession> {
    const session = new CodexAgentSession(input);
    await session.start();
    return session;
  }
}

export class CodexAgentSession implements AgentSession {
  readonly id = randomUUID();
  readonly #events = new AsyncEventQueue<AgentEvent>();
  readonly events = this.#events as AsyncIterable<AgentEvent>;
  readonly #input: AgentInput;

  #process: ChildProcessWithoutNullStreams | null = null;
  #stdout: Interface | null = null;
  #stderr: Interface | null = null;
  #nextRequestId = 1;
  #pending = new Map<string | number, PendingRequest>();
  #pendingServerRequests = new Map<string | number, AppServerMessage>();
  #threadId: string | null = null;
  #activeTurnId: string | null = null;
  #disposed = false;
  #stderrTail: string[] = [];

  constructor(input: AgentInput) {
    this.#input = { ...input, cwd: resolve(input.cwd) };
  }

  async start() {
    const child = spawn("codex", codexAppServerArgs(this.#input), {
      cwd: this.#input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    this.#process = child;
    this.#stdout = createInterface({ input: child.stdout });
    this.#stderr = createInterface({ input: child.stderr });
    this.#stdout.on("line", (line) => this.#handleLine(line));
    this.#stderr.on("line", (line) => this.#handleStderr(line));
    child.on("error", (error) => this.#rejectAll(error));
    child.on("exit", (code, signal) => {
      if (!this.#disposed && code && code !== 0) {
        const suffix = this.#stderrTail.length
          ? `\n${this.#stderrTail.join("\n")}`
          : "";
        this.#events.push({
          type: "error",
          message: `Codex app-server exited with code ${code}${suffix}`,
          error: { code, signal },
        });
      }
      this.#rejectAll(new Error("Codex app-server exited."));
      this.#events.close();
    });

    await this.#request("initialize", {
      clientInfo: {
        name: "beancount_studio_local_ai",
        title: "Beancount Studio Local AI",
        version: "0.1.0",
      },
      capabilities: { experimentalApi: true },
    });
    this.#notify("initialized", {});
    const started = (await this.#request("thread/start", {
      model: this.#input.model ?? null,
      cwd: this.#input.cwd,
      runtimeWorkspaceRoots: [this.#input.cwd],
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: true,
    })) as { thread?: { id?: string; sessionId?: string } };
    this.#threadId = started.thread?.id ?? null;
    if (!this.#threadId)
      throw new Error("Codex did not create a conversation thread.");
    this.#events.push({
      type: "session_started",
      provider: "codex",
      sessionId: started.thread?.sessionId ?? this.id,
      threadId: this.#threadId,
    });
  }

  async send(prompt: string) {
    if (!this.#threadId) throw new Error("Codex session has not started.");
    const response = (await this.#request("turn/start", {
      threadId: this.#threadId,
      input: [{ type: "text", text: prompt, text_elements: [] }],
      cwd: this.#input.cwd,
      runtimeWorkspaceRoots: [this.#input.cwd],
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      approvalPolicy: "never",
    })) as { turn?: { id?: string } };
    this.#activeTurnId = response.turn?.id ?? this.#activeTurnId;
  }

  async cancel() {
    if (!this.#threadId) return;
    try {
      await this.#request("turn/interrupt", {
        threadId: this.#threadId,
        turnId: this.#activeTurnId ?? undefined,
      });
    } catch {
      // Cancellation is intentionally idempotent for browser aborts.
    }
  }

  async respondToRequest(
    requestId: string | number,
    response: ApprovalResponse,
  ) {
    const pending = this.#pendingServerRequests.get(requestId);
    if (!pending)
      throw new Error(
        `No pending Codex request exists for ${String(requestId)}.`,
      );
    this.#pendingServerRequests.delete(requestId);
    this.#send({
      id: pending.id,
      result: approvalResponseResultForServerRequest(pending, response),
    });
  }

  async dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stdout?.close();
    this.#stderr?.close();
    this.#rejectAll(new Error("Codex session disposed."));
    this.#process?.kill("SIGTERM");
    this.#events.close();
  }

  #request(method: string, params: unknown): Promise<unknown> {
    const id = this.#nextRequestId++;
    this.#send({ id, method, params });
    return new Promise((resolve, reject) =>
      this.#pending.set(id, { resolve, reject }),
    );
  }

  #notify(method: string, params: unknown) {
    this.#send({ method, params });
  }

  #send(message: AppServerMessage) {
    const stdin = this.#process?.stdin;
    if (!stdin?.writable)
      throw new Error("Codex app-server stdin is not writable.");
    stdin.write(`${JSON.stringify(message)}\n`);
  }

  #handleLine(line: string) {
    if (!line.trim()) return;
    let message: AppServerMessage;
    try {
      message = JSON.parse(line) as AppServerMessage;
    } catch {
      this.#events.push({
        type: "error",
        message: `Invalid Codex app-server JSONL: ${line}`,
      });
      return;
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        const error = message.error as { message?: unknown };
        pending.reject(new Error(String(error.message ?? message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    const autoApproval = autoApprovalResultForServerRequest(message);
    if (autoApproval && message.id !== undefined) {
      this.#send({ id: message.id, result: autoApproval });
      return;
    }
    const approval = approvalRequestFromServerRequest(message);
    if (approval && message.id !== undefined) {
      this.#pendingServerRequests.set(message.id, message);
      this.#events.push({ type: "approval_requested", request: approval });
      return;
    }
    for (const event of mapCodexNotification(message)) {
      if (event.type === "done") this.#activeTurnId = null;
      this.#events.push(event);
    }
  }

  #handleStderr(line: string) {
    if (!line.trim()) return;
    this.#stderrTail.push(line);
    if (this.#stderrTail.length > 20) this.#stderrTail.shift();
  }

  #rejectAll(error: Error) {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    this.#pendingServerRequests.clear();
  }
}
