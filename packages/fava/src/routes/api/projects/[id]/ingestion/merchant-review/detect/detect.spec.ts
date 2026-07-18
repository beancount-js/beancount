import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildClusters: vi.fn(),
  enrichProposals: vi.fn(),
  listActiveRules: vi.fn(),
  latestSyncJob: vi.fn(),
  readProject: vi.fn(),
  readRuns: vi.fn(),
  source: vi.fn(),
  writeRuns: vi.fn(),
}));

vi.mock("@beancount-js/beancount", () => ({
  loadProjectSources: () => [[], []],
}));

vi.mock("@beancount-js/server", () => ({
  applyMerchantResolutionToPendingProposals: vi.fn(),
  buildMerchantReviewClusters: mocks.buildClusters,
  enrichProposals: mocks.enrichProposals,
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    latestSyncJob: mocks.latestSyncJob,
    readRuns: mocks.readRuns,
    source: mocks.source,
    writeRuns: mocks.writeRuns,
  }),
}));

vi.mock("$lib/server/rules", () => ({
  serverRules: () => ({ listActive: mocks.listActiveRules }),
}));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({ readProject: mocks.readProject }),
}));

import { POST } from "./+server";

describe("POST /ingestion/merchant-review/detect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.source.mockResolvedValue({ id: "source" });
    mocks.readRuns.mockResolvedValue([
      { id: "run-a", proposals: [{ id: "proposal-a" }] },
      { id: "run-b", proposals: [{ id: "proposal-b" }] },
    ]);
    mocks.latestSyncJob.mockResolvedValue(undefined);
    mocks.readProject.mockResolvedValue({
      project: { entryFile: "main.bean" },
      ledgerFiles: [],
    });
    mocks.listActiveRules.mockResolvedValue([]);
    mocks.buildClusters.mockReturnValue({
      clusters: [
        {
          id: "cluster-a",
          primary: { runId: "run-a", proposalId: "proposal-a" },
          members: [{ normalizedLabel: "first" }],
        },
        {
          id: "cluster-b",
          primary: { runId: "run-b", proposalId: "proposal-b" },
          members: [{ normalizedLabel: "second" }],
        },
      ],
    });
    mocks.enrichProposals.mockResolvedValue({
      proposals: [{ id: "proposal-a" }],
      debug: { calls: [] },
    });
  });

  test("detects only the selected merchant clusters", async () => {
    const response = await POST({
      params: { id: "demo" },
      request: new Request("https://example.test/api", {
        method: "POST",
        body: JSON.stringify({
          sourceId: "source",
          clusterIds: ["cluster-a"],
        }),
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      runIds: ["run-a", "run-b"],
      clusters: 1,
      calls: 0,
    });
    expect(mocks.enrichProposals.mock.calls[0]?.[1]).toEqual([
      { id: "proposal-a" },
    ]);
  });

  test("rejects an empty selected-cluster list", async () => {
    const response = await POST({
      params: { id: "demo" },
      request: new Request("https://example.test/api", {
        method: "POST",
        body: JSON.stringify({ sourceId: "source", clusterIds: [] }),
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "clusterIds must be a non-empty list of cluster ids.",
    });
  });
});
