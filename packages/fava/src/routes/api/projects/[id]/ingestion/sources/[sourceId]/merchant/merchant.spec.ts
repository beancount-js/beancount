import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: vi.fn(),
  confirm: vi.fn(),
  downloadLogo: vi.fn(),
  enrich: vi.fn(),
  findByDomain: vi.fn(),
  logoUrl: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    writeConfig: mocks.writeConfig,
    projectRoot: mocks.projectRoot,
    merchants: {
      confirm: mocks.confirm,
      findByDomain: mocks.findByDomain,
      get: vi.fn(),
      cacheLogo: vi.fn(),
    },
  }),
}));

vi.mock("@beancount-js/server", () => ({
  BrandfetchProvider: class {
    enrich = mocks.enrich;
    downloadLogo = mocks.downloadLogo;
  },
  createBrandfetchResponseCache: mocks.cache,
  isValidDomain: (domain: string) => domain.includes("."),
  merchantLogoUrlFor: mocks.logoUrl,
  resolveBrandfetchRuntime: mocks.resolveRuntime,
}));

import { POST } from "./+server";

const source = {
  id: "starling",
  name: "Starling Bank",
  kind: "starling",
  config: { baseUrl: "https://api.starlingbank.com" },
  rules: [],
};

const brandfetch = {
  enabled: true,
  apiKeySecretRef: "env:BRANDFETCH_API_KEY",
  clientId: "env:BRANDFETCH_CLIENT_ID",
};

describe("POST /ingestion/sources/:sourceId/merchant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectRoot.mockResolvedValue("/projects/demo");
    mocks.resolveRuntime.mockResolvedValue({
      apiKey: "test-key",
      clientId: "client-id",
    });
    mocks.enrich.mockResolvedValue({
      id: "brandfetch:starlingbank.com",
      canonicalName: "Starling Bank",
      domain: "starlingbank.com",
      description: "A digital bank.",
      explanation: "Brandfetch validated the domain.",
      provenance: [
        {
          source: "brandfetch",
          provider: "brandfetch",
          observedAt: "2026-07-17T00:00:00.000Z",
        },
      ],
      logoUrl: "https://cdn.example.test/starling.png",
    });
    mocks.confirm.mockResolvedValue({
      merchantId: "merchant-starling",
      canonicalName: "Starling Bank",
      domain: "starlingbank.com",
      aliases: [],
      provenance: [],
    });
    mocks.findByDomain.mockResolvedValue(undefined);
    mocks.logoUrl.mockReturnValue("/merchant-starling-logo.png");
  });

  test("derives a public domain, persists the merchant, and attaches it to the connection", async () => {
    const initialConfig = {
      version: 2 as const,
      brandfetch,
      sources: [source],
    };
    const persistedSource = { ...source, merchantId: "merchant-starling" };
    mocks.readConfig
      .mockResolvedValueOnce(initialConfig)
      .mockResolvedValueOnce({ ...initialConfig, sources: [persistedSource] });

    const response = await POST({
      params: { id: "demo", sourceId: "starling" },
    });

    expect(response.status).toBe(200);
    expect(mocks.enrich).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "starlingbank.com",
        canonicalName: "Starling Bank",
      }),
    );
    expect(mocks.confirm).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        sourceId: "starling",
        rawLabel: "Starling Bank",
      }),
    );
    expect(mocks.writeConfig).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        sources: [expect.objectContaining({ merchantId: "merchant-starling" })],
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      source: { merchantId: "merchant-starling" },
      merchant: {
        merchantId: "merchant-starling",
        logoUrl: "/merchant-starling-logo.png",
      },
    });
  });

  test("requires Brandfetch before changing the connection", async () => {
    mocks.readConfig.mockResolvedValue({
      version: 2,
      brandfetch: { ...brandfetch, enabled: false },
      sources: [source],
    });

    const response = await POST({
      params: { id: "demo", sourceId: "starling" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enable Brandfetch before updating a connection logo.",
    });
    expect(mocks.enrich).not.toHaveBeenCalled();
    expect(mocks.writeConfig).not.toHaveBeenCalled();
  });
});
