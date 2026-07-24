import { createInterface } from "node:readline";
import { loadProjectSources } from "@beancount-js/beancount";
import { runBql } from "@beancount-js/beanquery";
import { FilesystemWorkspaceAdapter } from "@beancount-js/server";
import type { AiSessionRecord, ProjectSnapshot } from "@beancount-js/workspace";
import { hasPendingProposal, normalizeLedgerChatSession } from "$lib/ai/chat";
import { ledgerProposal } from "$lib/server/ai-ledger";

type JsonRpcMessage = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type LedgerMcpContext = {
  projectId: string;
  sessionId: string;
  activePath?: string;
  workspace?: FilesystemWorkspaceAdapter;
};

const tools = [
  {
    name: "ledger_list_sources",
    description:
      "List the selected Beancount project's entry file, editable ledger sources, revisions, and discovery issues. Read-only.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ledger_read",
    description:
      "Read a bounded line range from an editable ledger source. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        startLine: { type: "number" },
        endLine: { type: "number" },
      },
    },
  },
  {
    name: "ledger_search",
    description:
      "Case-insensitively search editable ledger sources and return bounded matching line excerpts. Read-only.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "ledger_query",
    description:
      "Run a read-only Beancount Query Language (BQL) query against the current ledger. Results are bounded.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "ledger_propose_change",
    description:
      "Create one review-only change proposal for one ledger source. Never writes a file. Every oldText block must occur exactly once in the source; proposed changes are rejected if they introduce new ledger validation errors.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        title: { type: "string" },
        replacements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              oldText: { type: "string" },
              newText: { type: "string" },
            },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "replacements"],
    },
  },
];

function number(value: unknown, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(1, Math.floor(value)))
    : fallback;
}

function string(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required.`);
  return value.trim();
}

function source(snapshot: ProjectSnapshot, path: string) {
  const found = snapshot.ledgerFiles.find((file) => file.path === path);
  if (!found) throw new Error(`Ledger file not found: ${path}`);
  return found;
}

function jsonSafe(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const record = value as Record<string, unknown>;
    const entries = Object.entries(record);
    if (
      !entries.length &&
      typeof (value as { toString?: () => string }).toString === "function"
    ) {
      return String(value);
    }
    return Object.fromEntries(
      entries.map(([key, item]) => [key, jsonSafe(item, seen)]),
    );
  }
  return String(value);
}

async function snapshotFor(context: LedgerMcpContext) {
  return (context.workspace ?? new FilesystemWorkspaceAdapter()).readProject(
    context.projectId,
  );
}

async function proposalPending(context: LedgerMcpContext) {
  const workspace = context.workspace ?? new FilesystemWorkspaceAdapter();
  const record = (await workspace.readAiSession(
    context.projectId,
    context.sessionId,
  )) as AiSessionRecord | null;
  return record
    ? hasPendingProposal(normalizeLedgerChatSession(record.session))
    : false;
}

export async function callLedgerTool(
  name: string,
  args: Record<string, unknown>,
  context: LedgerMcpContext,
) {
  const snapshot = await snapshotFor(context);
  if (name === "ledger_list_sources") {
    return {
      project: {
        id: snapshot.project.id,
        name: snapshot.project.name,
        entryFile: snapshot.project.entryFile,
      },
      sources: snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        revision: snapshot.revisions.find(
          (revision) => revision.path === file.path,
        )?.revision,
        size: file.size,
        updatedAt: file.updatedAt,
      })),
      issues: snapshot.issues,
    };
  }
  if (name === "ledger_read") {
    const path =
      typeof args.path === "string"
        ? args.path
        : (context.activePath ?? snapshot.project.entryFile);
    const file = source(snapshot, path);
    const lines = file.contents.split("\n");
    const startLine = number(args.startLine, 1, lines.length || 1);
    const endLine = Math.min(
      lines.length || 1,
      Math.max(
        startLine,
        number(
          args.endLine,
          Math.min(lines.length || 1, startLine + 199),
          startLine + 399,
        ),
      ),
    );
    return {
      path: file.path,
      revision: snapshot.revisions.find(
        (revision) => revision.path === file.path,
      )?.revision,
      startLine,
      endLine,
      contents: lines
        .slice(startLine - 1, endLine)
        .join("\n")
        .slice(0, 40_000),
    };
  }
  if (name === "ledger_search") {
    const query = string(args.query, "query").toLocaleLowerCase();
    const limit = number(args.limit, 20, 50);
    const matches: Array<{ path: string; line: number; excerpt: string }> = [];
    for (const file of snapshot.ledgerFiles) {
      const lines = file.contents.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].toLocaleLowerCase().includes(query)) continue;
        matches.push({
          path: file.path,
          line: index + 1,
          excerpt: lines
            .slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
            .join("\n"),
        });
        if (matches.length >= limit) return { query, matches, truncated: true };
      }
    }
    return { query, matches, truncated: false };
  }
  if (name === "ledger_query") {
    const query = string(args.query, "query");
    const limit = number(args.limit, 100, 200);
    const [directives, errors, options] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const result = runBql(directives, query, { errors, options });
    return {
      columns: result.columns.map((column) => ({
        name: column.name,
        type: String(column.type),
      })),
      data: result.data.slice(0, limit).map((row) => jsonSafe(row)),
      ...(result.data.length > limit ? { truncated: true } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  }
  if (name === "ledger_propose_change") {
    if (await proposalPending(context)) {
      throw new Error(
        "Resolve the current pending ledger proposal before creating another one.",
      );
    }
    const path = string(args.path, "path");
    const replacements = Array.isArray(args.replacements)
      ? args.replacements.map((replacement) => {
          if (
            !replacement ||
            typeof replacement !== "object" ||
            Array.isArray(replacement)
          ) {
            throw new Error("Each replacement must be an object.");
          }
          const values = replacement as Record<string, unknown>;
          if (
            typeof values.oldText !== "string" ||
            typeof values.newText !== "string"
          ) {
            throw new Error(
              "Each replacement needs oldText and newText strings.",
            );
          }
          return { oldText: values.oldText, newText: values.newText };
        })
      : [];
    return ledgerProposal(snapshot, {
      path,
      title: typeof args.title === "string" ? args.title : undefined,
      replacements,
    });
  }
  throw new Error(`Unknown ledger tool: ${name}`);
}

export function startMcpServer(context: Omit<LedgerMcpContext, "workspace">) {
  const workspace = new FilesystemWorkspaceAdapter();
  const send = (message: Record<string, unknown>) =>
    process.stdout.write(`${JSON.stringify(message)}\n`);
  const input = createInterface({ input: process.stdin });
  let inputClosed = false;
  let pendingRequests = 0;
  const exitWhenDrained = () => {
    if (inputClosed && pendingRequests === 0) process.exit(0);
  };
  input.on("close", () => {
    inputClosed = true;
    exitWhenDrained();
  });
  input.on("line", (line) => {
    pendingRequests += 1;
    void (async () => {
      let request: JsonRpcMessage;
      try {
        request = JSON.parse(line) as JsonRpcMessage;
      } catch {
        return;
      }
      if (request.method === "initialize") {
        if (request.id !== undefined) {
          send({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "beancount_studio", version: "0.1.0" },
            },
          });
        }
        return;
      }
      if (request.method === "notifications/initialized") return;
      if (request.method === "tools/list") {
        if (request.id !== undefined)
          send({ jsonrpc: "2.0", id: request.id, result: { tools } });
        return;
      }
      if (request.method === "tools/call") {
        try {
          const name = string(request.params?.name, "tool name");
          const args =
            request.params?.arguments &&
            typeof request.params.arguments === "object" &&
            !Array.isArray(request.params.arguments)
              ? (request.params.arguments as Record<string, unknown>)
              : {};
          const result = await callLedgerTool(name, args, {
            ...context,
            workspace,
          });
          if (request.id !== undefined) {
            send({
              jsonrpc: "2.0",
              id: request.id,
              result: {
                content: [{ type: "text", text: JSON.stringify(result) }],
                structuredContent: result,
              },
            });
          }
        } catch (error) {
          if (request.id !== undefined) {
            send({
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32000,
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        }
        return;
      }
      if (request.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Method not found" },
        });
      }
    })().finally(() => {
      pendingRequests -= 1;
      exitWhenDrained();
    });
  });
}
