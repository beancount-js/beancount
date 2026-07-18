import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildReview: vi.fn(),
  readConfig: vi.fn(),
  readProject: vi.fn(),
  readReconciliations: vi.fn(),
  readRuns: vi.fn(),
}));

vi.mock("@beancount-js/beancount", () => ({
  loadProjectSources: () => [[], []],
}));

vi.mock("@beancount-js/server", () => ({
  buildReconciliationReview: mocks.buildReview,
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    readRuns: mocks.readRuns,
  }),
  serverReconciliations: () => ({ read: mocks.readReconciliations }),
}));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({ readProject: mocks.readProject }),
}));

import { GET } from "./+server";

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
});
