import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { projectBrandfetchCacheRoot } from "./paths";

const CACHE_VERSION = 1;
const DAY_MS = 86_400_000;
const DEFAULT_TTL_DAYS = 29;
const NOT_FOUND_TTL_MS = DAY_MS;
const RATE_LIMIT_TTL_MS = 15 * 60_000;

export type BrandfetchCachedStatus = 200 | 404 | 429;

export interface BrandfetchCachedResponse {
  version: 1;
  method: string;
  url: string;
  /** SHA-256 of the request body (empty string for GET). */
  bodyHash: string;
  status: BrandfetchCachedStatus;
  fetchedAt: string;
  expiresAt: string;
  /** Parsed JSON body for 200 responses; null for 404/429. */
  body: unknown | null;
  /** ISO timestamp when a 429 may be retried, if Brandfetch reported one. */
  retryAt?: string;
  /** Snapshot of Brandfetch quota headers when the entry was written. */
  rateLimit?: {
    quota?: number;
    approximateUsage?: number;
    retryAfterSeconds?: number;
  };
}

export interface BrandfetchResponseCache {
  get(
    method: string,
    url: string,
    requestBody?: string,
  ): Promise<BrandfetchCachedResponse | undefined>;
  set(
    entry: Omit<BrandfetchCachedResponse, "bodyHash"> & {
      requestBody?: string;
    },
  ): Promise<void>;
}

function bodyHash(requestBody = "") {
  return createHash("sha256").update(requestBody).digest("hex");
}

function cacheKey(method: string, url: string, requestBody = "") {
  return createHash("sha256")
    .update(`${method.toUpperCase()}\n${url}\n${requestBody}`)
    .digest("hex");
}

function ttlMs(days: number | undefined) {
  const bounded = Math.min(Math.max(days ?? DEFAULT_TTL_DAYS, 1), 29);
  return bounded * DAY_MS;
}

export function brandfetchCacheExpiry(
  status: BrandfetchCachedStatus,
  ttlDays?: number,
  retryAfterSeconds?: number,
) {
  const now = Date.now();
  if (status === 404) return new Date(now + NOT_FOUND_TTL_MS).toISOString();
  if (status === 429) {
    const retryMs =
      typeof retryAfterSeconds === "number" &&
      Number.isFinite(retryAfterSeconds) &&
      retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, DAY_MS)
        : RATE_LIMIT_TTL_MS;
    return new Date(now + retryMs).toISOString();
  }
  return new Date(now + ttlMs(ttlDays)).toISOString();
}

function isFresh(entry: BrandfetchCachedResponse) {
  return Date.parse(entry.expiresAt) > Date.now();
}

/**
 * Durable Brandfetch API response cache under
 * `.beancount/ingestion/brandfetch/responses/{sha256}.json`.
 */
export class FilesystemBrandfetchResponseCache
  implements BrandfetchResponseCache
{
  constructor(private readonly projectRoot: string) {}

  private pathFor(method: string, url: string, requestBody = "") {
    return join(
      projectBrandfetchCacheRoot(this.projectRoot),
      `${cacheKey(method, url, requestBody)}.json`,
    );
  }

  async get(method: string, url: string, requestBody = "") {
    try {
      const raw = await fs.readFile(
        this.pathFor(method, url, requestBody),
        "utf8",
      );
      const entry = JSON.parse(raw) as BrandfetchCachedResponse;
      if (
        entry.version !== CACHE_VERSION ||
        entry.method !== method.toUpperCase() ||
        entry.url !== url ||
        entry.bodyHash !== bodyHash(requestBody) ||
        !isFresh(entry)
      ) {
        return undefined;
      }
      return entry;
    } catch {
      return undefined;
    }
  }

  async set(
    entry: Omit<BrandfetchCachedResponse, "bodyHash"> & {
      requestBody?: string;
    },
  ) {
    const requestBody = entry.requestBody ?? "";
    const directory = projectBrandfetchCacheRoot(this.projectRoot);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const path = this.pathFor(entry.method, entry.url, requestBody);
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    const { requestBody: _ignored, ...rest } = entry;
    const payload: BrandfetchCachedResponse = {
      ...rest,
      version: CACHE_VERSION,
      method: entry.method.toUpperCase(),
      bodyHash: bodyHash(requestBody),
    };
    await fs.writeFile(temporary, JSON.stringify(payload, null, 2), {
      mode: 0o600,
    });
    await fs.rename(temporary, path);
  }
}

/** Create a project-scoped Brandfetch response cache. */
export function createBrandfetchResponseCache(projectRoot: string) {
  return new FilesystemBrandfetchResponseCache(projectRoot);
}
