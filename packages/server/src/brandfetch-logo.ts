import type { MerchantBrandAsset } from "@beancount-js/beangulp";
import { downloadBrandfetchLogo, type BrandfetchLogoSize } from "./brandfetch";

const DAY_MS = 86_400_000;

export type BrandfetchLogoDelivery = "local-cache" | "server-proxy";

export interface BrandfetchLogoSettings {
  delivery: BrandfetchLogoDelivery;
  refreshDays: number;
  highResolution: boolean;
}

export interface StoredMerchantLogo {
  bytes: Uint8Array;
  mediaType: MerchantBrandAsset["mediaType"];
  sha256: string;
  size?: BrandfetchLogoSize;
  expiresAt: string;
}

interface MerchantLogoStore {
  logo(
    project: string,
    merchantId: string,
  ): Promise<StoredMerchantLogo | undefined>;
  cacheLogo(
    project: string,
    merchantId: string,
    asset: {
      bytes: Uint8Array;
      mediaType: MerchantBrandAsset["mediaType"];
      extension: "png" | "jpg" | "webp";
      sha256: string;
      size: BrandfetchLogoSize;
      expiresAt: string;
    },
  ): Promise<unknown>;
}

export interface ResolvedMerchantLogo extends StoredMerchantLogo {
  /** Whether this response came from a durable merchant profile asset. */
  persisted: boolean;
}

interface DownloadedMerchantLogo extends ResolvedMerchantLogo {
  extension: "png" | "jpg" | "webp";
  size: BrandfetchLogoSize;
}

export function brandfetchLogoSize(
  settings: Pick<BrandfetchLogoSettings, "highResolution">,
): BrandfetchLogoSize {
  return settings.highResolution ? 120 : 40;
}

function refreshDeadline(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function isFresh(logo: StoredMerchantLogo, size: BrandfetchLogoSize) {
  return logo.size === size && Date.parse(logo.expiresAt) > Date.now();
}

/**
 * Server-owned Logo API delivery. This keeps credentials out of browser URLs,
 * serialises identical fetches, and writes only when local cache mode requests
 * a merchant asset.
 */
export class BrandfetchLogoService {
  private readonly inFlight = new Map<
    string,
    Promise<DownloadedMerchantLogo>
  >();

  constructor(
    private readonly merchants: MerchantLogoStore,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async download(
    key: string,
    domain: string,
    clientId: string,
    size: BrandfetchLogoSize,
  ) {
    const current = this.inFlight.get(key);
    if (current) return current;
    const work = (async () => {
      const downloaded = await downloadBrandfetchLogo({
        domain,
        clientId,
        size,
        fetcher: this.fetcher,
      });
      return {
        ...downloaded,
        expiresAt: "",
        persisted: false,
      } satisfies DownloadedMerchantLogo;
    })();
    this.inFlight.set(key, work);
    try {
      return await work;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Stream a temporary candidate logo through the app server without storing it. */
  async proxyDomain(options: {
    project: string;
    domain: string;
    clientId: string;
    settings: Pick<BrandfetchLogoSettings, "highResolution">;
  }) {
    const size = brandfetchLogoSize(options.settings);
    return this.download(
      `proxy:${options.project}:${options.domain}:${size}`,
      options.domain,
      options.clientId,
      size,
    );
  }

  async merchantLogo(options: {
    project: string;
    merchantId: string;
    domain?: string;
    clientId?: string;
    settings: BrandfetchLogoSettings;
    force?: boolean;
  }): Promise<ResolvedMerchantLogo | undefined> {
    const stored = await this.merchants.logo(
      options.project,
      options.merchantId,
    );
    if (options.settings.delivery === "server-proxy") {
      if (!options.domain || !options.clientId)
        return stored && { ...stored, persisted: true };
      return this.proxyDomain({
        project: options.project,
        domain: options.domain,
        clientId: options.clientId,
        settings: options.settings,
      });
    }

    const size = brandfetchLogoSize(options.settings);
    if (stored && !options.force && isFresh(stored, size)) {
      return { ...stored, persisted: true };
    }
    if (
      stored &&
      !options.force &&
      stored.size === size &&
      Date.parse(stored.expiresAt) <= Date.now()
    ) {
      if (options.domain && options.clientId) {
        void this.refreshMerchant(options).catch(() => undefined);
      }
      return { ...stored, persisted: true };
    }
    if (!options.domain || !options.clientId) {
      return stored ? { ...stored, persisted: true } : undefined;
    }
    return this.refreshMerchant(options);
  }

  async refreshMerchant(options: {
    project: string;
    merchantId: string;
    domain?: string;
    clientId?: string;
    settings: BrandfetchLogoSettings;
    force?: boolean;
  }) {
    if (!options.domain || !options.clientId)
      throw new Error(
        "A merchant domain and Brandfetch client ID are required.",
      );
    const size = brandfetchLogoSize(options.settings);
    const key = `merchant:${options.project}:${options.merchantId}:${size}`;
    const downloaded = await this.download(
      key,
      options.domain,
      options.clientId,
      size,
    );
    const expiresAt = refreshDeadline(options.settings.refreshDays);
    await this.merchants.cacheLogo(options.project, options.merchantId, {
      ...downloaded,
      expiresAt,
    });
    return { ...downloaded, expiresAt, persisted: true };
  }
}
