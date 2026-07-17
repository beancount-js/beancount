import { describe, expect, test } from "vitest";
import {
  BrandfetchLogoService,
  type StoredMerchantLogo,
} from "./brandfetch-logo";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function store(initial?: StoredMerchantLogo) {
  const writes: Array<Record<string, unknown>> = [];
  return {
    writes,
    logo: async () => initial,
    cacheLogo: async (
      _project: string,
      _merchantId: string,
      asset: Record<string, unknown>,
    ) => {
      writes.push(asset);
    },
  };
}

describe("BrandfetchLogoService", () => {
  test("proxies a missing 120px logo immediately and persists it in the background", async () => {
    const merchants = store();
    const requests: string[] = [];
    const service = new BrandfetchLogoService(merchants, async (input) => {
      requests.push(String(input));
      return new Response(png, {
        headers: { "content-type": "image/png" },
      });
    });

    const logo = await service.merchantLogo({
      project: "project",
      merchantId: "merchant",
      domain: "tesco.com",
      clientId: "client-id",
      settings: {
        delivery: "local-cache",
        refreshDays: 30,
        highResolution: true,
      },
    });

    expect(requests).toEqual([
      expect.stringContaining("/h/120/w/120/icon.png"),
    ]);
    expect(logo).toMatchObject({ persisted: false, size: 120 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(merchants.writes).toEqual([
      expect.objectContaining({ size: 120, mediaType: "image/png" }),
    ]);
  });

  test("proxies without writing an asset in server-proxy mode", async () => {
    const merchants = store();
    const service = new BrandfetchLogoService(
      merchants,
      async () =>
        new Response(png, { headers: { "content-type": "image/png" } }),
    );

    const logo = await service.merchantLogo({
      project: "project",
      merchantId: "merchant",
      domain: "tesco.com",
      clientId: "client-id",
      settings: {
        delivery: "server-proxy",
        refreshDays: 30,
        highResolution: false,
      },
    });

    expect(merchants.writes).toHaveLength(0);
    expect(logo).toMatchObject({ persisted: false, size: 40 });
  });

  test("serves a stale matching asset while refreshing it", async () => {
    const existing: StoredMerchantLogo = {
      bytes: png,
      mediaType: "image/png",
      sha256: "old",
      size: 40,
      expiresAt: "2020-01-01T00:00:00.000Z",
    };
    const merchants = store(existing);
    const service = new BrandfetchLogoService(
      merchants,
      async () =>
        new Response(png, { headers: { "content-type": "image/png" } }),
    );

    await expect(
      service.merchantLogo({
        project: "project",
        merchantId: "merchant",
        domain: "tesco.com",
        clientId: "client-id",
        settings: {
          delivery: "local-cache",
          refreshDays: 30,
          highResolution: false,
        },
      }),
    ).resolves.toMatchObject({ sha256: "old", persisted: true });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(merchants.writes).toHaveLength(1);
  });
});
