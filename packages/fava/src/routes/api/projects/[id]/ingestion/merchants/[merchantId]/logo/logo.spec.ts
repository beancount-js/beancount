import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  merchantLogo: vi.fn(),
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    merchants: { get: mocks.get },
    logos: { merchantLogo: mocks.merchantLogo },
    projectRoot: mocks.projectRoot,
    readConfig: mocks.readConfig,
  }),
}));

vi.mock("@beancount-js/server", () => ({
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
        delivery: "local-cache",
        refreshDays: 30,
        highResolution: true,
      },
    });
    mocks.projectRoot.mockResolvedValue("/projects/demo");
    mocks.resolveRuntime.mockResolvedValue({ clientId: "private-client-id" });
    mocks.merchantLogo.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/png",
      sha256: "asset-hash",
      size: 120,
      expiresAt: "2099-01-01T00:00:00.000Z",
      persisted: true,
    });
  });

  test("serves the local asset through the app without exposing credentials", async () => {
    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"asset-hash"');
    expect(await response.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(mocks.merchantLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "private-client-id",
        settings: expect.objectContaining({ highResolution: true }),
      }),
    );
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

  test("returns an internal fallback image rather than a browser-visible 404", async () => {
    mocks.merchantLogo.mockRejectedValue(new Error("Logo API unavailable"));

    const response = await GET({
      params: { id: "demo", merchantId: "merchant" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("x-logo-fallback")).toBe("true");
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
    expect(mocks.merchantLogo).not.toHaveBeenCalled();
  });
});
