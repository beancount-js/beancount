import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readProject: vi.fn() }));

vi.mock("$lib/server/workspace", () => ({
  serverWorkspace: async () => ({ readProject: mocks.readProject }),
}));

import { GET } from "./+server";

describe("GET /ai/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("fuzzy-ranks file mentions and retains the twenty-result cap", async () => {
    mocks.readProject.mockResolvedValue({
      ledgerFiles: Array.from({ length: 21 }, (_, index) => ({
        path: `ledger/receipts/${2026 - index}.bean`,
      })),
    });

    const response = await GET({
      params: { id: "demo" },
      url: new URL("https://example.test/api?query=reciepts"),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.files).toHaveLength(20);
    expect(body.files[0]).toEqual({ path: "ledger/receipts/2026.bean" });
  });
});
