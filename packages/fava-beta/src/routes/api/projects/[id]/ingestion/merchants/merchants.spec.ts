import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  logoUrl: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    projectRoot: mocks.projectRoot,
    merchants: { list: mocks.list },
  }),
}));

vi.mock("@beancount-js/server", () => ({
  merchantLogoUrlFor: mocks.logoUrl,
  resolveBrandfetchRuntime: mocks.resolveRuntime,
}));

import { GET } from "./+server";

describe("GET /ingestion/merchants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfig.mockResolvedValue({ version: 2, sources: [] });
    mocks.logoUrl.mockImplementation(
      (_projectId: string, merchant: { merchantId: string }) =>
        `/logos/${merchant.merchantId}.svg`,
    );
  });

  test("fuzzy-ranks merchant names, domains, and aliases without changing its DTO", async () => {
    mocks.list.mockResolvedValue([
      {
        merchantId: "starling",
        canonicalName: "Starling Bank",
        domain: "starlingbank.com",
        aliases: [{ normalizedValue: "starling" }],
      },
      {
        merchantId: "amex",
        canonicalName: "American Express",
        domain: "americanexpress.com",
        aliases: [{ normalizedValue: "amex" }],
      },
    ]);

    const response = await GET({
      params: { id: "demo" },
      url: new URL("https://example.test/api?query=amrican"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        merchantId: "amex",
        logoUrl: "/logos/amex.svg",
      }),
    ]);
  });
});
