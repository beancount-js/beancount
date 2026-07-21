import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoConfirmable: vi.fn(),
  buildReview: vi.fn(),
  confirmedProposals: vi.fn(),
  readConfig: vi.fn(),
  readProject: vi.fn(),
  readReconciliations: vi.fn(),
  readRuns: vi.fn(),
  removeReconciliation: vi.fn(),
  saveReconciliation: vi.fn(),
}));

vi.mock("@beancount-js/beancount", () => ({
  loadProjectSources: () => [[], []],
}));

vi.mock("@beancount-js/server", () => ({
  autoConfirmableMappedOverlaps: mocks.autoConfirmable,
  buildReconciliationReview: mocks.buildReview,
  confirmedProposalReconciliations: mocks.confirmedProposals,
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    readRuns: mocks.readRuns,
  }),
  serverReconciliations: () => ({
    read: mocks.readReconciliations,
    save: mocks.saveReconciliation,
    remove: mocks.removeReconciliation,
  }),
}));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({ readProject: mocks.readProject }),
}));

import { DELETE, GET, POST } from "./+server";

describe("GET /ingestion/reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readProject.mockResolvedValue({
      project: { entryFile: "main.bean" },
      ledgerFiles: [],
    });
    mocks.readConfig.mockResolvedValue({});
    mocks.readRuns.mockResolvedValue([]);
    mocks.readReconciliations.mockResolvedValue([]);
    mocks.autoConfirmable.mockReturnValue([]);
    mocks.confirmedProposals.mockReturnValue([]);
    mocks.buildReview.mockReturnValue({
      candidates: [
        { candidate: { id: "first" } },
        { candidate: { id: "second" } },
      ],
    });
  });

  test("returns a compact candidate count for the Records filter", async () => {
    const response = await GET({
      params: { id: "demo" },
      url: new URL("https://example.test/api?summary=count"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 2 });
  });

  test("returns confirmed proposal annotations for ordinary review rows", async () => {
    mocks.confirmedProposals.mockReturnValue([
      {
        runId: "run-1",
        proposalId: "proposal-1",
        candidateId: "candidate-1",
        kind: "overlap",
      },
    ]);

    const response = await GET({
      params: { id: "demo" },
      url: new URL("https://example.test/api?summary=proposal-reconciliations"),
    });

    await expect(response.json()).resolves.toEqual({
      reconciliations: [
        {
          runId: "run-1",
          proposalId: "proposal-1",
          candidateId: "candidate-1",
          kind: "overlap",
        },
      ],
    });
  });

  test("auto-confirms only the server-selected mapped candidates", async () => {
    const item = {
      candidate: {
        id: "candidate-1",
        kind: "overlap",
        recommendedCanonicalId: "proposal:run-1:proposal-1",
      },
      members: [],
    };
    mocks.buildReview.mockReturnValue({ candidates: [item] });
    mocks.autoConfirmable.mockReturnValue([item]);

    const response = await POST({
      params: { id: "demo" },
      request: new Request("https://example.test/api", {
        method: "POST",
        body: JSON.stringify({ action: "auto-confirm" }),
      }),
    });

    expect(mocks.saveReconciliation).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        candidateId: "candidate-1",
        state: "confirmed",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      confirmedCandidateIds: ["candidate-1"],
    });
  });

  test("clears a confirmed decision instead of dismissing its candidate", async () => {
    mocks.buildReview.mockReturnValue({
      candidates: [
        {
          candidate: { id: "candidate-1", kind: "overlap" },
          members: [],
          decision: { state: "confirmed" },
        },
      ],
    });

    const response = await DELETE({
      params: { id: "demo" },
      request: new Request("https://example.test/api", {
        method: "DELETE",
        body: JSON.stringify({ candidateId: "candidate-1" }),
      }),
    });

    expect(mocks.removeReconciliation).toHaveBeenCalledWith(
      "demo",
      "candidate-1",
    );
    expect(response.status).toBe(200);
  });
});
