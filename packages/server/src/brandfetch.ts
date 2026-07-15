import { createHash } from "node:crypto";
import type {
  MerchantBrandAsset,
  MerchantBrandData,
  MerchantCandidate,
  MerchantProvenance,
} from "@beancount-js/beangulp";

const BRAND_API = "https://api.brandfetch.io/v2";
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const PROVIDER_TTL_MS = 29 * 24 * 60 * 60 * 1000;

export interface BrandfetchConfig {
  apiKey: string;
  clientId?: string;
  allowNameSearch?: boolean;
  allowTransactionLookup?: boolean;
  ttlDays?: number;
  fetch?: typeof fetch;
}

export interface BrandfetchLookupInput {
  rawLabel?: string;
  countryCode?: string;
}

export interface DownloadedBrandAsset {
  bytes: Uint8Array;
  mediaType: MerchantBrandAsset["mediaType"];
  extension: "png" | "jpg" | "webp";
  sha256: string;
  expiresAt: string;
}

function providerExpiry(days: number | undefined) {
  const bounded = Math.min(Math.max(days ?? 29, 1), 29);
  return new Date(
    Date.now() + Math.min(bounded * 86_400_000, PROVIDER_TTL_MS),
  ).toISOString();
}

export function isValidDomain(value: string | undefined) {
  if (!value || value.length > 253 || /[/:?#\s]/.test(value)) return false;
  const domain = value.toLowerCase().replace(/\.$/, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  );
}

export function brandfetchLogoUrl(domain: string, clientId: string) {
  const path = encodeURIComponent(domain.toLowerCase());
  const client = encodeURIComponent(clientId);
  return `https://cdn.brandfetch.io/domain/${path}/h/128/w/128/icon.png?c=${client}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function brandDetails(
  value: unknown,
  fallback: MerchantCandidate,
  config: BrandfetchConfig,
) {
  const record = asRecord(value);
  const domain = text(record.domain) ?? fallback.domain;
  const name = text(record.name) ?? fallback.canonicalName;
  const industries = Array.isArray(record.industries)
    ? record.industries
        .map((item) => text(asRecord(item).name) ?? text(item))
        .filter((item): item is string => Boolean(item))
    : [];
  const now = new Date().toISOString();
  const brand: MerchantBrandData | undefined = domain
    ? {
        provider: "brandfetch",
        brandId: text(record.id),
        fetchedAt: now,
        expiresAt: providerExpiry(config.ttlDays),
      }
    : undefined;
  const provenance: MerchantProvenance = {
    source: "brandfetch",
    provider: "brandfetch",
    version: "v2",
    observedAt: now,
  };
  return {
    ...fallback,
    id: `brandfetch:${domain ?? fallback.id}`,
    canonicalName: name,
    domain,
    description: text(record.description) ?? fallback.description,
    industry: industries[0] ?? text(record.industry) ?? fallback.industry,
    countryCode: text(record.countryCode) ?? fallback.countryCode,
    explanation: `Brandfetch validated ${domain ?? name} as ${name}.`,
    provenance: [...fallback.provenance, provenance],
    brand,
    logoUrl:
      domain && config.clientId
        ? brandfetchLogoUrl(domain, config.clientId)
        : fallback.logoUrl,
  } satisfies MerchantCandidate;
}

function brandfetchUrl(path: string) {
  return new URL(path, `${BRAND_API}/`).toString();
}

export class BrandfetchProvider {
  private readonly fetcher: typeof fetch;

  constructor(readonly config: BrandfetchConfig) {
    this.fetcher = config.fetch ?? fetch;
  }

  private async request(url: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${this.config.apiKey}`);
    const response = await this.fetcher(url, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(`Brandfetch request failed with ${response.status}.`);
    return response.json() as Promise<unknown>;
  }

  async enrich(
    candidate: MerchantCandidate,
    input: BrandfetchLookupInput = {},
  ): Promise<MerchantCandidate | undefined> {
    let response: unknown | undefined;
    if (isValidDomain(candidate.domain)) {
      response = await this.request(
        brandfetchUrl(`brands/domain/${encodeURIComponent(candidate.domain!)}`),
      );
    } else if (this.config.allowNameSearch && this.config.clientId) {
      const query = encodeURIComponent(candidate.canonicalName);
      const search = await this.request(
        `${brandfetchUrl(`search/${query}`)}?c=${encodeURIComponent(this.config.clientId)}`,
      );
      const first = Array.isArray(search) ? search[0] : asRecord(search).brands;
      const match = Array.isArray(first) ? first[0] : first;
      const domain = text(asRecord(match).domain);
      if (domain && isValidDomain(domain)) {
        response = await this.request(
          brandfetchUrl(`brands/domain/${encodeURIComponent(domain)}`),
        );
      }
    } else if (
      this.config.allowTransactionLookup &&
      input.rawLabel &&
      input.countryCode
    ) {
      response = await this.request(brandfetchUrl("brands/transaction"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionLabel: input.rawLabel,
          countryCode: input.countryCode,
        }),
      });
    }
    return response
      ? brandDetails(response, candidate, this.config)
      : undefined;
  }

  async downloadLogo(url: string): Promise<DownloadedBrandAsset> {
    let next = new URL(url);
    for (let redirects = 0; redirects <= 2; redirects += 1) {
      if (
        next.protocol !== "https:" ||
        (next.hostname !== "brandfetch.io" &&
          !next.hostname.endsWith(".brandfetch.io"))
      ) {
        throw new Error("Refusing an unapproved Brandfetch logo host.");
      }
      const response = await this.fetcher(next, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location)
          throw new Error("Brandfetch logo redirect had no location.");
        next = new URL(location, next);
        continue;
      }
      if (!response.ok)
        throw new Error(`Brand logo request failed with ${response.status}.`);
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_ASSET_BYTES)
        throw new Error("Brand logo exceeds the 2 MiB limit.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_ASSET_BYTES)
        throw new Error("Brand logo exceeds the 2 MiB limit.");
      const mediaType = rasterMediaType(
        bytes,
        response.headers.get("content-type"),
      );
      if (!mediaType)
        throw new Error("Brand logo must be a PNG, JPEG, or WebP image.");
      return {
        bytes,
        mediaType,
        extension:
          mediaType === "image/png"
            ? "png"
            : mediaType === "image/webp"
              ? "webp"
              : "jpg",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        expiresAt: providerExpiry(this.config.ttlDays),
      };
    }
    throw new Error("Brandfetch logo redirected too many times.");
  }
}

function rasterMediaType(
  bytes: Uint8Array,
  contentType: string | null,
): MerchantBrandAsset["mediaType"] | undefined {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const actual = isPng
    ? "image/png"
    : isJpeg
      ? "image/jpeg"
      : isWebp
        ? "image/webp"
        : undefined;
  if (!actual) return undefined;
  const declared = contentType?.split(";", 1)[0].trim().toLowerCase();
  return declared === actual ? actual : undefined;
}
