import type {
  StarlingAccount,
  StarlingFeedItem,
  StarlingTransactionPage,
} from "./types";
import { DEFAULT_BASE_URL } from "./types";

export type StarlingErrorType =
  | "bad_request"
  | "unauthorized"
  | "access_forbidden"
  | "not_found"
  | "rate_limited"
  | "fetch_failed"
  | "request_failed"
  | "unknown";

export class StarlingError extends Error {
  readonly errorType: StarlingErrorType;
  readonly retryAfter?: string;

  constructor(
    message: string,
    errorType: StarlingErrorType = "unknown",
    options?: { retryAfter?: string },
  ) {
    super(message);
    this.name = "StarlingError";
    this.errorType = errorType;
    this.retryAfter = options?.retryAfter;
  }
}

function assertSafeUrl(
  value: string,
  allowedHosts: readonly string[] | undefined,
  label: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StarlingError(`${label} must be a valid URL.`, "bad_request");
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new StarlingError(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
      "bad_request",
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new StarlingError(
      `${label} host ${url.hostname} is not in this source's allowlist.`,
      "bad_request",
    );
  }
  return url;
}

function describeError(error: unknown, depth = 0): string {
  if (depth > 4 || error == null) return "";
  if (!(error instanceof Error)) return String(error);
  const parts = error.message ? [error.message] : [];
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    const nested = describeError(cause, depth + 1);
    if (nested && !parts.includes(nested)) parts.push(nested);
  }
  return parts.join(": ");
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const direct = scalar(
    record.message ?? record.error ?? record.error_description,
  );
  if (direct) return direct;
  if (!Array.isArray(record.errors)) return undefined;
  const messages = record.errors.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const detail = item as Record<string, unknown>;
    const message = scalar(
      detail.message ?? detail.description ?? detail.error,
    );
    return message ? [message] : [];
  });
  return messages.length ? messages.join("; ") : undefined;
}

function pause(delayMs: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(finish, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export interface StarlingClientOptions {
  accessToken: string;
  baseUrl?: string;
  allowedHosts?: readonly string[];
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  /** Starling personal access tokens are limited to five requests per second. */
  minRequestIntervalMs?: number;
}

export class StarlingClient {
  private readonly accessToken: string;
  private readonly baseUrl: URL;
  private readonly allowedHosts?: readonly string[];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly signal?: AbortSignal;
  private readonly minRequestIntervalMs: number;
  private lastRequestAt = 0;

  constructor(options: StarlingClientOptions) {
    this.accessToken = options.accessToken;
    this.allowedHosts = options.allowedHosts;
    this.baseUrl = assertSafeUrl(
      options.baseUrl?.trim() || DEFAULT_BASE_URL,
      this.allowedHosts,
      "Starling base URL",
    );
    const request = options.fetch ?? globalThis.fetch;
    if (!request) {
      throw new StarlingError(
        "No Fetch implementation is available.",
        "request_failed",
      );
    }
    this.fetchImpl = request;
    this.signal = options.signal;
    this.minRequestIntervalMs = Math.max(
      0,
      options.minRequestIntervalMs ?? 200,
    );
  }

  private authHeaders() {
    return {
      authorization: `Bearer ${this.accessToken}`,
      accept: "application/json",
      "user-agent": "beancount-js-studio",
    };
  }

  private resolveUrl(pathOrUrl: string, query?: Record<string, string>) {
    const url = /^[a-z][a-z\d+.-]*:/i.test(pathOrUrl)
      ? assertSafeUrl(pathOrUrl, this.allowedHosts, "Starling URL")
      : new URL(pathOrUrl.replace(/^\/+/, ""), `${this.baseUrl.origin}/`);
    assertSafeUrl(url.toString(), this.allowedHosts, "Starling URL");
    if (url.origin !== this.baseUrl.origin) {
      throw new StarlingError(
        "Starling pagination and redirects must remain on the configured origin.",
        "bad_request",
      );
    }
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) url.searchParams.set(key, value);
    }
    return url;
  }

  private async fetchGet(url: URL) {
    let current = url;
    for (let hop = 0; hop < 5; hop += 1) {
      const wait = this.lastRequestAt + this.minRequestIntervalMs - Date.now();
      await pause(wait, this.signal);
      this.lastRequestAt = Date.now();

      let response: Response;
      try {
        response = await this.fetchImpl(current, {
          method: "GET",
          headers: this.authHeaders(),
          redirect: "manual",
          signal: this.signal,
        });
      } catch (error) {
        throw new StarlingError(
          `Could not reach ${current.toString()} (${describeError(error) || "fetch failed"}).`,
          "request_failed",
        );
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new StarlingError(
            `Starling redirected from ${current.toString()} without a Location header.`,
            "fetch_failed",
          );
        }
        current = this.resolveUrl(new URL(location, current).toString());
        continue;
      }
      return response;
    }
    throw new StarlingError(
      `Starling redirected too many times (last URL ${current.toString()}).`,
      "fetch_failed",
    );
  }

  private async get(pathOrUrl: string, query?: Record<string, string>) {
    const url = this.resolveUrl(pathOrUrl, query);
    const response = await this.fetchGet(url);
    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        if (response.ok) {
          throw new StarlingError(
            "Failed to parse Starling API response.",
            "fetch_failed",
          );
        }
        body = text;
      }
    }
    if (response.ok) return body;

    const detail = errorDetail(body);
    if (response.status === 400) {
      throw new StarlingError(
        detail
          ? `Bad request to Starling API: ${detail}`
          : "Bad request to Starling API.",
        "bad_request",
      );
    }
    if (response.status === 401) {
      throw new StarlingError("Invalid Starling access token.", "unauthorized");
    }
    if (response.status === 403) {
      throw new StarlingError(
        detail
          ? `Starling access is forbidden: ${detail}`
          : "Starling access is forbidden; check account:read, account-list:read, and transaction:read scopes.",
        "access_forbidden",
      );
    }
    if (response.status === 404) {
      throw new StarlingError(
        detail
          ? `Starling resource not found: ${detail}`
          : "Starling resource not found.",
        "not_found",
      );
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") ?? undefined;
      throw new StarlingError(
        retryAfter
          ? `Starling rate limit exceeded. Retry after ${retryAfter}.`
          : "Starling rate limit exceeded. Try again later.",
        "rate_limited",
        { retryAfter },
      );
    }
    throw new StarlingError(
      detail
        ? `Starling API request failed with status ${response.status}: ${detail}`
        : `Starling API request failed with status ${response.status}.`,
      "fetch_failed",
    );
  }

  async getAccounts(): Promise<StarlingAccount[]> {
    const body = (await this.get("api/v2/accounts")) as {
      accounts?: unknown;
    };
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    return accounts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const accountUid = scalar(record.accountUid);
      const defaultCategory = scalar(record.defaultCategory);
      const currency = scalar(record.currency);
      const name = scalar(record.name);
      if (!accountUid || !defaultCategory || !currency || !name) return [];
      return [
        {
          accountUid,
          defaultCategory,
          currency,
          name,
          accountType: scalar(record.accountType),
          createdAt: scalar(record.createdAt),
        } satisfies StarlingAccount,
      ];
    });
  }

  async getChangedTransactions(options: {
    accountUid: string;
    categoryUid: string;
    changesSince: string;
  }): Promise<StarlingFeedItem[]> {
    const body = (await this.get(
      `api/v2/feed/account/${encodeURIComponent(options.accountUid)}/category/${encodeURIComponent(options.categoryUid)}`,
      { changesSince: options.changesSince },
    )) as { feedItems?: unknown };
    return Array.isArray(body?.feedItems)
      ? body.feedItems.filter(
          (item): item is StarlingFeedItem =>
            !!item && typeof item === "object",
        )
      : [];
  }

  async getTransactionPage(options: {
    accountUid: string;
    categoryUid: string;
    minTransactionTimestamp: string;
    maxTransactionTimestamp: string;
    nextUrl?: string;
  }): Promise<StarlingTransactionPage> {
    const body = (await this.get(
      options.nextUrl ??
        `api/v2/feed/account/${encodeURIComponent(options.accountUid)}/category/${encodeURIComponent(options.categoryUid)}/paginated-transactions`,
      options.nextUrl
        ? undefined
        : {
            minTransactionTimestamp: options.minTransactionTimestamp,
            maxTransactionTimestamp: options.maxTransactionTimestamp,
          },
    )) as { feedItems?: unknown; links?: { next?: unknown } };
    return {
      feedItems: Array.isArray(body?.feedItems)
        ? body.feedItems.filter(
            (item): item is StarlingFeedItem =>
              !!item && typeof item === "object",
          )
        : [],
      next: scalar(body?.links?.next),
    };
  }
}
