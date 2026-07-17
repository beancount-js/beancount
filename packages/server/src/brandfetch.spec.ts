import { describe, expect, test, vi } from "vitest";
import {
  brandfetchLogoUrl,
  downloadBrandfetchLogo,
  isValidDomain,
} from "./brandfetch";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Brandfetch Logo API", () => {
  test("builds a Logo API URL using the requested resolution", () => {
    expect(brandfetchLogoUrl("Tesco.COM", "client id")).toBe(
      "https://cdn.brandfetch.io/tesco.com/h/40/w/40/icon.png?c=client%20id",
    );
    expect(brandfetchLogoUrl("tesco.com", "client", 120)).toContain(
      "/h/120/w/120/",
    );
  });

  test("accepts public domains and rejects invalid identifiers", () => {
    expect(isValidDomain("starlingbank.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("https://starlingbank.com")).toBe(false);
  });

  test("uses the configured User-Agent and caches a valid logo after a CDN redirect", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://media.brandfetch.io/logo.png" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(png, { headers: { "content-type": "image/png" } }),
      );

    const logo = await downloadBrandfetchLogo({
      domain: "tesco.com",
      clientId: "client-id",
      size: 120,
      userAgent: "Bean Budget cache test/1.0",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "user-agent": "Bean Budget cache test/1.0",
      }),
      redirect: "manual",
    });
    expect(logo).toMatchObject({
      mediaType: "image/png",
      extension: "png",
      size: 120,
    });
  });

  test("rejects redirects outside Brandfetch", async () => {
    await expect(
      downloadBrandfetchLogo({
        domain: "tesco.com",
        clientId: "client-id",
        size: 40,
        userAgent: "Bean Budget cache test/1.0",
        fetcher: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://example.test/logo.png" },
          }),
      }),
    ).rejects.toThrow("Invalid Brandfetch logo host");
  });
});
