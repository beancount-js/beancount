import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectRoot: vi.fn(),
  readConfig: vi.fn(),
  resolveRuntime: vi.fn(),
}));

vi.mock("$lib/server/ingestion", () => ({
  serverIngestion: () => ({
    projectRoot: mocks.projectRoot,
    readConfig: mocks.readConfig,
  }),
}));

vi.mock("@beancount-js/server", () => ({
  brandfetchLogoUrl: (domain: string, clientId: string, size: number) =>
    `https://cdn.brandfetch.io/${domain}/h/${size}/w/${size}/icon.png?c=${clientId}`,
  isValidDomain: (domain: string) => domain.includes("."),
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
  });

  test("redirects a candidate logo for the browser to fetch directly", async () => {
    const response = await GET({
      params: { id: "demo", domain: "starlingbank.com" },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("x-logo-source")).toBe("brandfetch-redirect");
    expect(response.headers.get("location")).toBe(
      "https://cdn.brandfetch.io/starlingbank.com/h/40/w/40/icon.png?c=private-client-id",
    );
  });

  test("does not proxy when Brandfetch is disabled", async () => {
    mocks.readConfig.mockResolvedValue({ brandfetch: { enabled: false } });
    const response = await GET({
      params: { id: "demo", domain: "starlingbank.com" },
    });

    expect(response.status).toBe(404);
  });

  test("rejects invalid domains before creating a redirect", async () => {
    const response = await GET({
      params: { id: "demo", domain: "not a domain" },
    });

    expect(response.status).toBe(404);
  });
});
