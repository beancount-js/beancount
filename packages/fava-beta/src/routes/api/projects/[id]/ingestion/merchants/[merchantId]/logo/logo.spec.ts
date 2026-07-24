import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  logo: vi.fn(),
  cacheLogo: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
  downloadLogo: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    merchants: {
      get: mocks.get,
      logo: mocks.logo,
      cacheLogo: mocks.cacheLogo,
    },
    projectRoot: mocks.projectRoot,
    readConfig: mocks.readConfig,
  }),
}));

vi.mock("@beancount-js/server", () => ({
  brandfetchLogoUrl: (domain: string, clientId: string, size: number) =>
    `https://cdn.brandfetch.io/${domain}/h/${size}/w/${size}/icon.png?c=${clientId}`,
  downloadBrandfetchLogo: mocks.downloadLogo,
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
    mocks.downloadLogo.mockResolvedValue({
      bytes: new Uint8Array([4, 5, 6]),
      mediaType: "image/png",
      extension: "png",
      sha256: "downloaded-hash",
      size: 120,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
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
    expect(mocks.downloadLogo).not.toHaveBeenCalled();
  });

  test("caches a missing logo with the configured User-Agent", async () => {
    mocks.logo.mockResolvedValue(undefined);
    mocks.readConfig.mockResolvedValue({
      brandfetch: {
        enabled: true,
        highResolution: true,
        cacheUserAgent: "Bean Budget cache test/1.0",
      },
    });

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-logo-source")).toBe("server-cache");
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([4, 5, 6]).buffer,
    );
    expect(mocks.downloadLogo).toHaveBeenCalledWith({
      domain: "starlingbank.com",
      clientId: "private-client-id",
      size: 120,
      userAgent: "Bean Budget cache test/1.0",
    });
    expect(mocks.cacheLogo).toHaveBeenCalledWith(
      "demo",
      "merchant",
      expect.objectContaining({ sha256: "downloaded-hash" }),
    );
  });

  test("falls back to browser delivery when the cache attempt fails", async () => {
    mocks.logo.mockResolvedValue(undefined);
    mocks.readConfig.mockResolvedValue({
      brandfetch: {
        enabled: true,
        highResolution: true,
        cacheUserAgent: "Bean Budget cache test/1.0",
      },
    });
    mocks.downloadLogo.mockRejectedValue(new Error("CDN blocked"));

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("x-logo-source")).toBe("brandfetch-redirect");
    expect(mocks.cacheLogo).not.toHaveBeenCalled();
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
