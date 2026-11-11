import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  categoryAccounts: vi.fn(),
  envSecretAvailable: vi.fn(),
  readConfig: vi.fn(),
  readProject: vi.fn(),
  resolveProjectEnv: vi.fn(),
  startSync: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock("@beancount-js/beancount", () => ({
  loadProjectSources: () => [
    [{ accounts: ["Assets:Checking", "Expenses:Food"] }],
    [],
  ],
}));

vi.mock("@beancount-js/server", () => ({
  envSecretAvailable: mocks.envSecretAvailable,
  resolveProjectEnv: mocks.resolveProjectEnv,
  sourceSecretRef: (source: { secretRef?: string }) => source.secretRef,
}));

vi.mock("$lib/server/ingestion", () => ({
  categoryAccountsForSource: mocks.categoryAccounts,
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    writeConfig: mocks.writeConfig,
  }),
}));

vi.mock("$lib/server/sync-jobs", () => ({
  latestSyncJobForSource: vi.fn(),
  startIngestionSync: mocks.startSync,
}));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({
    projectRoot: async () => "/projects/demo",
    readProject: mocks.readProject,
  }),
}));

import { GET, PUT } from "./+server";
import { POST as POST_SYNC } from "./sync/+server";

describe("production ingestion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readProject.mockResolvedValue({
      project: { entryFile: "main.beancount" },
      ledgerFiles: [{ path: "main.beancount", contents: "" }],
    });
    mocks.resolveProjectEnv.mockResolvedValue({ BANK_TOKEN: "configured" });
    mocks.envSecretAvailable.mockImplementation(
      (reference: string | undefined) => reference === "env:BANK_TOKEN",
    );
    mocks.categoryAccounts.mockReturnValue(["Expenses:Food"]);
    mocks.readConfig.mockResolvedValue({
      version: 3,
      sources: [
        {
          id: "bank",
          name: "Bank",
          secretRef: "env:BANK_TOKEN",
        },
      ],
    });
  });

  test("exposes persisted sources with credential and ledger-account state", async () => {
    const response = await GET({ params: { id: "demo" } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: 3,
      accounts: ["Assets:Checking", "Expenses:Food"],
      sources: [
        {
          id: "bank",
          credentialAvailable: true,
          allowedAccounts: ["Expenses:Food"],
        },
      ],
    });
  });

  test("persists configuration only for an opened project", async () => {
    const next = { version: 3, sources: [] };
    mocks.readConfig.mockResolvedValue(next);
    const response = await PUT({
      params: { id: "demo" },
      request: new Request("https://example.test/ingestion", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      }),
    });

    expect(mocks.readProject).toHaveBeenCalledWith("demo");
    expect(mocks.writeConfig).toHaveBeenCalledWith("demo", next);
    expect(response.status).toBe(200);
  });

  test("starts a real connector sync through the host job runner", async () => {
    const job = { id: "sync:1", status: "queued" };
    mocks.startSync.mockResolvedValue({ job, created: true });
    const response = await POST_SYNC({
      params: { id: "demo" },
      request: new Request("https://example.test/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "bank" }),
      }),
    });

    expect(mocks.startSync).toHaveBeenCalledWith({
      projectId: "demo",
      sourceId: "bank",
      kind: "sync",
    });
    expect(response.status).toBe(202);
  });
});
