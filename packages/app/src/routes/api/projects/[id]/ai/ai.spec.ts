import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  LEDGER_CHAT_SESSION_ID,
  newLedgerChatSession,
  type LedgerChatSession,
} from "$lib/ai/chat";

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  readAiSession: vi.fn(),
  readProject: vi.fn(),
  validateProposal: vi.fn(),
  writeAiSession: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("$lib/server/ai", () => ({
  activeLedgerAiSession: vi.fn(),
  disposeLedgerAiSession: mocks.dispose,
  getActiveLedgerAiSession: () => null,
  ledgerAgentPrompt: vi.fn(),
  withActiveLedgerAiSession: vi.fn(),
}));

vi.mock("$lib/server/ai-ledger", () => ({
  validateLedgerProposal: mocks.validateProposal,
}));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({
    readAiSession: mocks.readAiSession,
    readProject: mocks.readProject,
    writeAiSession: mocks.writeAiSession,
    writeFile: mocks.writeFile,
  }),
}));

import { GET, PUT } from "./+server";
import { PATCH } from "./proposals/[proposalId]/+server";

const snapshot = {
  project: { id: "demo", name: "Demo", entryFile: "main.beancount" },
  ledgerFiles: [{ path: "main.beancount", contents: "old" }],
  revisions: [{ path: "main.beancount", revision: "revision-1" }],
  resources: [],
  issues: [],
  envKeys: [],
};

describe("production assistant routes", () => {
  let stored: LedgerChatSession | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stored = undefined;
    mocks.readProject.mockResolvedValue(snapshot);
    mocks.readAiSession.mockImplementation(async () =>
      stored
        ? {
            projectId: "demo",
            sessionId: LEDGER_CHAT_SESSION_ID,
            session: stored,
            updatedAt: stored.updatedAt,
          }
        : null,
    );
    mocks.writeAiSession.mockImplementation(
      async (_projectId: string, record: { session: LedgerChatSession }) => {
        stored = record.session;
      },
    );
    mocks.validateProposal.mockReturnValue({ contents: "new", errors: [] });
  });

  test("persists the selected model in the project-scoped chat session", async () => {
    const response = await PUT({
      params: { id: "demo" },
      request: new Request("https://example.test/ai", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "gpt-5.4-mini" }),
      }),
    });

    expect(response.status).toBe(200);
    expect(stored?.model).toBe("gpt-5.4-mini");
    const reloaded = await GET({ params: { id: "demo" } });
    await expect(reloaded.json()).resolves.toMatchObject({
      session: { model: "gpt-5.4-mini", title: "AI · Demo" },
    });
  });

  test("keeps a valid proposal with revision-aware ledger persistence", async () => {
    stored = {
      ...newLedgerChatSession("", "AI · Demo"),
      items: [
        {
          id: "proposal-1",
          type: "proposal",
          proposal: {
            id: "proposal-1",
            kind: "ledger",
            title: "Update ledger",
            file: { path: "main.beancount", revision: "revision-1" },
            replacements: [{ oldText: "old", newText: "new" }],
            valid: true,
          },
        },
      ],
    };

    const response = await PATCH({
      params: { id: "demo", proposalId: "proposal-1" },
      request: new Request("https://example.test/proposal", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "keep" }),
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      "demo",
      { path: "main.beancount", contents: "new" },
      { expectedRevision: "revision-1" },
    );
    expect(stored?.items[0]).toMatchObject({
      proposal: { status: "kept" },
    });
  });
});
