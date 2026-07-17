import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectRoot: vi.fn(),
  proxyDomain: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    logos: { proxyDomain: mocks.proxyDomain },
    projectRoot: mocks.projectRoot,
    readConfig: mocks.readConfig,
  }),
}));

vi.mock("@beancount-js/server", () => ({
  resolveBrandfetchRuntime: mocks.resolveRuntime,
}));

import { GET } from "./+server";

describe("GET /ingestion/logos/:domain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfig.mockResolvedValue({
      brandfetch: { enabled: true, highResolution: false },
    });
    mocks.projectRoot.mockResolvedValue("/projects/demo");
    mocks.resolveRuntime.mockResolvedValue({ clientId: "private-client-id" });
    mocks.proxyDomain.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "image/png",
      sha256: "proxy-hash",
    });
  });

  test("proxies a candidate logo internally without persisting an asset", async () => {
    const response = await GET({
      params: { id: "demo", domain: "starlingbank.com" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(mocks.proxyDomain).toHaveBeenCalledWith({
      project: "demo",
      domain: "starlingbank.com",
      clientId: "private-client-id",
      settings: { highResolution: false },
    });
  });

  test("does not proxy when Brandfetch is disabled", async () => {
    mocks.readConfig.mockResolvedValue({ brandfetch: { enabled: false } });
    const response = await GET({
      params: { id: "demo", domain: "starlingbank.com" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(404);
    expect(mocks.proxyDomain).not.toHaveBeenCalled();
  });

  test("returns an internal fallback image when the Logo API cannot serve a candidate", async () => {
    mocks.proxyDomain.mockRejectedValue(new Error("Logo API unavailable"));
    const response = await GET({
      params: { id: "demo", domain: "starlingbank.com" },
      request: new Request("http://localhost/logo"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("x-logo-fallback")).toBe("true");
  });
});
