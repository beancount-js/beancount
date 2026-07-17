import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  logo: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    merchants: { get: mocks.get, logo: mocks.logo },
    projectRoot: mocks.projectRoot,
    readConfig: mocks.readConfig,
  }),
}));

vi.mock("@beancount-js/server", () => ({
  brandfetchLogoUrl: (domain: string, clientId: string, size: number) =>
    `https://cdn.brandfetch.io/${domain}/h/${size}/w/${size}/icon.png?c=${clientId}`,
  resolveBrandfetchRuntime: mocks.resolveRuntime,
}));

import { GET } from "./+server";

describe("GET /ingestion/merchants/:merchantId/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({
      merchantId: "merchant",
      domain: "starlingbank.com",
    });
    mocks.readConfig.mockResolvedValue({
      brandfetch: {
        enabled: true,
        highResolution: true,
      },
    });
    mocks.projectRoot.mockResolvedValue("/projects/demo");
    mocks.resolveRuntime.mockResolvedValue({ clientId: "private-client-id" });
    mocks.logo.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/png",
      sha256: "asset-hash",
      size: 120,
      expiresAt: "2099-01-01T00:00:00.000Z",
      persisted: true,
    });
  });

  test("serves a persisted local asset through the app", async () => {
    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"asset-hash"');
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(response.headers.get("x-logo-source")).toBe("local");
  });

  test("honours the stored ETag after resolving local delivery", async () => {
    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo", {
        headers: { "if-none-match": '"asset-hash"' },
      }),
    });

    expect(response.status).toBe(304);
  });

  test("redirects a missing local asset for the browser to fetch from Brandfetch", async () => {
    mocks.logo.mockResolvedValue(undefined);

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("x-logo-source")).toBe("brandfetch-redirect");
    expect(response.headers.get("location")).toBe(
      "https://cdn.brandfetch.io/starlingbank.com/h/120/w/120/icon.png?c=private-client-id",
    );
  });

  test("redirects an incompatible stored resolution to use the selected size", async () => {
    mocks.logo.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/png",
      sha256: "asset-hash",
      size: 40,
      expiresAt: "2099-01-01T00:00:00.000Z",
      persisted: true,
    });

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/h/120/w/120/");
  });

  test("returns a two-letter SVG avatar without calling Brandfetch when no domain exists", async () => {
    mocks.get.mockResolvedValue({
      merchantId: "merchant",
      canonicalName: "Lunch Flow",
    });

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-logo-fallback")).toBe("true");
    await expect(response.text()).resolves.toContain(">LF</text>");
    expect(mocks.logo).not.toHaveBeenCalled();
  });
});
