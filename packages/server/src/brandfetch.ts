import { createHash } from "node:crypto";
import type {
  MerchantBrandAsset,
  MerchantBrandData,
  MerchantCandidate,
  MerchantProvenance,
} from "@beancount-js/beangulp";
import {
  brandfetchCacheExpiry,
  type BrandfetchResponseCache,
} from "./brandfetch-cache";

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
  /** Durable project-local response cache under `.beancount/ingestion/brandfetch`. */
  responseCache?: BrandfetchResponseCache;
  /** Skip reading the cache (still write after a live fetch). */
  bypassCache?: boolean;
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

/** Rate-limit / quota headers documented by Brandfetch Brand API. */
export type BrandfetchRateLimitInfo = {
  quota?: number;
  approximateUsage?: number;
  /** Seconds to wait before retrying, when the API sends Retry-After. */
  retryAfterSeconds?: number;
  /** Absolute retry time derived from Retry-After (seconds or HTTP-date). */
  retryAt?: string;
};

function parsePositiveInt(value: string | null) {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Parse Brandfetch quota / Retry-After headers from an API response. */
export function readBrandfetchRateLimit(
  headers: Headers,
  now = Date.now(),
): BrandfetchRateLimitInfo {
  const quota = parsePositiveInt(headers.get("x-api-key-quota"));
  const approximateUsage = parsePositiveInt(
    headers.get("x-api-key-approximate-usage"),
  );
  const retryAfterRaw = headers.get("retry-after")?.trim();
  let retryAfterSeconds: number | undefined;
  let retryAt: string | undefined;
  if (retryAfterRaw) {
    const asSeconds = Number.parseInt(retryAfterRaw, 10);
    if (Number.isFinite(asSeconds) && String(asSeconds) === retryAfterRaw) {
      retryAfterSeconds = Math.max(asSeconds, 0);
      retryAt = new Date(now + retryAfterSeconds * 1000).toISOString();
    } else {
      const asDate = Date.parse(retryAfterRaw);
      if (Number.isFinite(asDate)) {
        retryAt = new Date(asDate).toISOString();
        retryAfterSeconds = Math.max(Math.ceil((asDate - now) / 1000), 0);
      }
    }
  }
  return { quota, approximateUsage, retryAfterSeconds, retryAt };
}

export function formatBrandfetchRateLimitError(
  rateLimit: BrandfetchRateLimitInfo,
  cached = false,
) {
  const parts = [
    cached
      ? "Brandfetch request failed with 429 (cached)"
      : "Brandfetch request failed with 429",
  ];
  if (
    rateLimit.quota !== undefined ||
    rateLimit.approximateUsage !== undefined
  ) {
    parts.push(
      `quota ${rateLimit.approximateUsage ?? "?"}/${rateLimit.quota ?? "?"}`,
    );
  }
  if (rateLimit.retryAt) {
    parts.push(`retry after ${rateLimit.retryAt}`);
  } else if (rateLimit.retryAfterSeconds !== undefined) {
    parts.push(`retry after ${rateLimit.retryAfterSeconds}s`);
  } else {
    parts.push("no Retry-After header");
  }
  return `${parts[0]} (${parts.slice(1).join("; ")}).`;
}

export class BrandfetchProvider {
  private readonly fetcher: typeof fetch;
  /** In-flight dedupe for identical requests within one process/job. */
  private readonly inflight = new Map<string, Promise<unknown | undefined>>();

  constructor(readonly config: BrandfetchConfig) {
    this.fetcher = config.fetch ?? fetch;
  }

  private requestKey(method: string, url: string, body: string) {
    return `${method}\n${url}\n${body}`;
  }

  private async request(url: string, init?: RequestInit) {
    const method = (init?.method ?? "GET").toUpperCase();
    const requestBody =
      typeof init?.body === "string"
        ? init.body
        : init?.body == null
          ? ""
          : String(init.body);
    const key = this.requestKey(method, url, requestBody);
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const work = this.requestUncached(url, method, requestBody, init);
    this.inflight.set(key, work);
    try {
      return await work;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async requestUncached(
    url: string,
    method: string,
    requestBody: string,
    init?: RequestInit,
  ) {
    const cache = this.config.responseCache;
    if (cache && !this.config.bypassCache) {
      const cached = await cache.get(method, url, requestBody);
      if (cached) {
        if (cached.status === 404) return undefined;
        if (cached.status === 429) {
          throw new Error(
            formatBrandfetchRateLimitError(
              {
                quota: cached.rateLimit?.quota,
                approximateUsage: cached.rateLimit?.approximateUsage,
                retryAfterSeconds: cached.rateLimit?.retryAfterSeconds,
                retryAt: cached.retryAt,
              },
              true,
            ),
          );
        }
        return cached.body;
      }
    }

    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${this.config.apiKey}`);
    const response = await this.fetcher(url, {
      ...init,
      method,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
    const rateLimit = readBrandfetchRateLimit(response.headers);

    if (response.status === 404) {
      await cache?.set({
        version: 1,
        method,
        url,
        status: 404,
        fetchedAt: new Date().toISOString(),
        expiresAt: brandfetchCacheExpiry(404, this.config.ttlDays),
        body: null,
        requestBody,
      });
      return undefined;
    }

    if (response.status === 429) {
      const fetchedAt = new Date().toISOString();
      await cache?.set({
        version: 1,
        method,
        url,
        status: 429,
        fetchedAt,
        expiresAt: brandfetchCacheExpiry(
          429,
          this.config.ttlDays,
          rateLimit.retryAfterSeconds,
        ),
        body: null,
        requestBody,
        retryAt: rateLimit.retryAt,
        rateLimit: {
          quota: rateLimit.quota,
          approximateUsage: rateLimit.approximateUsage,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      });
      throw new Error(formatBrandfetchRateLimitError(rateLimit));
    }

    if (!response.ok) {
      throw new Error(`Brandfetch request failed with ${response.status}.`);
    }

    const body = (await response.json()) as unknown;
    await cache?.set({
      version: 1,
      method,
      url,
      status: 200,
      fetchedAt: new Date().toISOString(),
      expiresAt: brandfetchCacheExpiry(200, this.config.ttlDays),
      body,
      requestBody,
      rateLimit: {
        quota: rateLimit.quota,
        approximateUsage: rateLimit.approximateUsage,
      },
    });
    return body;
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
