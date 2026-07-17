import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandfetchLogoUrl: vi.fn(),
  confirm: vi.fn(),
  findByDomain: vi.fn(),
  logoUrl: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    readConfig: mocks.readConfig,
    projectRoot: mocks.projectRoot,
    merchants: {
      confirm: mocks.confirm,
      findByDomain: mocks.findByDomain,
    },
  }),
}));

vi.mock("@beancount-js/server", () => ({
  brandfetchLogoUrl: mocks.brandfetchLogoUrl,
  isValidDomain: (domain: string) => domain.includes("."),
  merchantLogoUrlFor: mocks.logoUrl,
  resolveBrandfetchRuntime: mocks.resolveRuntime,
}));

import { POST } from "./+server";

const brandfetch = {
  enabled: true,
  clientId: "env:BRANDFETCH_CLIENT_ID",
};

describe("POST /ingestion/merchants/brand-match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfig.mockResolvedValue({ version: 2, brandfetch, sources: [] });
    mocks.projectRoot.mockResolvedValue("/projects/demo");
    mocks.resolveRuntime.mockResolvedValue({ clientId: "client-id" });
    mocks.brandfetchLogoUrl.mockReturnValue(
      "https://cdn.brandfetch.io/domain/starlingbank.com?c=client-id",
    );
    mocks.findByDomain.mockResolvedValue(undefined);
    mocks.confirm.mockResolvedValue({
      merchantId: "merchant-starling",
      canonicalName: "Starling Bank",
      domain: "starlingbank.com",
      aliases: [],
      provenance: [],
    });
    mocks.logoUrl.mockReturnValue("/merchant-starling-logo.png");
  });

  test("creates a saved merchant with a Logo API logo from a typed URL", async () => {
    const response = await POST({
      params: { id: "demo" },
      request: new Request("http://localhost/brand-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://api.starlingbank.com/v2/accounts",
          sourceId: "starling",
          sourceName: "Starling Bank",
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.brandfetchLogoUrl).toHaveBeenCalledWith(
      "starlingbank.com",
      "client-id",
    );
    expect(mocks.confirm).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        sourceId: "starling",
        rawLabel: "Starling Bank",
        candidate: expect.objectContaining({
          canonicalName: "Starling Bank",
          domain: "starlingbank.com",
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      merchantId: "merchant-starling",
      logoUrl: "/merchant-starling-logo.png",
    });
  });

  test("creates an account-linked merchant from an Open directive URL", async () => {
    const response = await POST({
      params: { id: "demo" },
      request: new Request("http://localhost/brand-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "example.com/account",
          account: "Assets:Cash",
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.confirm).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        sourceId: "account:Assets:Cash",
        rawLabel: "Example",
        candidate: expect.objectContaining({
          canonicalName: "Example",
          domain: "example.com",
        }),
      }),
    );
  });

  test("rejects a URL that does not identify a public domain", async () => {
    const response = await POST({
      params: { id: "demo" },
      request: new Request("http://localhost/brand-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "not a URL",
          sourceId: "starling",
        }),
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid public URL to use Brand Match.",
    });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
