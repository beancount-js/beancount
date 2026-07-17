import { describe, expect, test } from "vitest";
import {
  brandfetchLogoUrl,
  downloadBrandfetchLogo,
  isValidDomain,
} from "./brandfetch";

describe("Brandfetch Logo API", () => {
  test("builds a Logo API URL using the requested resolution", () => {
    expect(brandfetchLogoUrl("Tesco.COM", "client id")).toBe(
      "https://cdn.brandfetch.io/domain/tesco.com/h/40/w/40/icon.png?c=client%20id",
    );
    expect(brandfetchLogoUrl("tesco.com", "client", 120)).toContain(
      "/h/120/w/120/",
    );
  });

  test("validates a bounded PNG response before it can be cached", async () => {
    const logo = await downloadBrandfetchLogo({
      domain: "tesco.com",
      clientId: "client-id",
      size: 120,
      fetcher: async () =>
        new Response(
          new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          { headers: { "content-type": "image/png" } },
        ),
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
        fetcher: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://example.test/logo.png" },
          }),
      }),
    ).rejects.toThrow("Invalid Brandfetch logo host");
  });

  test("accepts public domains and rejects invalid identifiers", () => {
    expect(isValidDomain("starlingbank.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("https://starlingbank.com")).toBe(false);
  });
});
