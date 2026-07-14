import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

type AppServerMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

export function codexAppServerArgs() {
  return [
    "app-server",
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
  ];
}

export interface CodexLedgerQuestion {
  cwd: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Ask the locally authenticated Codex app-server one read-only question. The
 * caller supplies a bounded ledger snapshot, so the assistant does not need
 * filesystem, shell, network, app, or multi-agent capabilities.
 */
export async function askCodexAboutLedger({
  cwd,
  prompt,
  model,
  timeoutMs = 90_000,
}: CodexLedgerQuestion): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", codexAppServerArgs(), {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    const output: string[] = [];
    const stderr: string[] = [];
    let nextId = 1;
    let threadId: string | undefined;
    let settled = false;
    const timer = setTimeout(
      () => finish(new Error("Codex account assistant timed out.")),
      timeoutMs,
    );

    const finish = (error?: Error, answer?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(answer?.trim() || "Codex did not return an answer.");
    };
    const send = (message: AppServerMessage) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    const request = (method: string, params: Record<string, unknown>) => {
      const id = nextId++;
      send({ id, method, params });
      return id;
    };

    createInterface({ input: child.stderr }).on("line", (line) => {
      if (line.trim()) stderr.push(line);
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (!line.trim() || settled) return;
      let message: AppServerMessage;
      try {
        message = JSON.parse(line) as AppServerMessage;
      } catch {
        return;
      }
      if (message.error) {
        finish(
          new Error(
            message.error.message ?? "Codex app-server returned an error.",
          ),
        );
        return;
      }
      if (message.id === 1) {
        send({ method: "initialized", params: {} });
        request("thread/start", { model: model ?? null, cwd });
        return;
      }
      if (message.id === 2) {
        threadId = (message.result?.thread as { id?: string } | undefined)?.id;
        if (!threadId)
          return finish(
            new Error("Codex did not create a conversation thread."),
          );
        request("turn/start", {
          threadId,
          input: [{ type: "text", text: prompt, text_elements: [] }],
          cwd,
          sandboxPolicy: { type: "readOnly", networkAccess: false },
          approvalPolicy: "never",
        });
        return;
      }
      if (message.method === "item/agentMessage/delta") {
        const delta = message.params?.delta;
        if (typeof delta === "string") output.push(delta);
        else if (
          delta &&
          typeof delta === "object" &&
          typeof (delta as { text?: unknown }).text === "string"
        ) {
          output.push((delta as { text: string }).text);
        }
        return;
      }
      if (message.method === "item/completed") {
        const item = message.params?.item as
          | { type?: string; text?: unknown }
          | undefined;
        if (item?.type === "agentMessage" && typeof item.text === "string")
          output.push(item.text);
        return;
      }
      if (message.method === "turn/completed")
        finish(undefined, output.join(""));
    });
    child.once("error", (error) => finish(error));
    child.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(
          new Error(
            `Codex app-server exited with code ${code}: ${stderr.slice(-4).join("\n")}`,
          ),
        );
      }
    });

    request("initialize", {
      clientInfo: {
        name: "beancount_studio",
        title: "Beancount Studio",
        version: "0.1.0",
      },
    });
  });
}
