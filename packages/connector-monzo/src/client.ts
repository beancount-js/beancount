import type {
  MonzoAccount,
  MonzoBalance,
  MonzoTransaction,
  MonzoTransactionPage,
} from "./types";
import { DEFAULT_BASE_URL, DEFAULT_PAGE_SIZE } from "./types";

export type MonzoErrorType =
  | "bad_request"
  | "unauthorized"
  | "access_forbidden"
  | "not_found"
  | "rate_limited"
  | "fetch_failed"
  | "request_failed"
  | "unknown";

export class MonzoError extends Error {
  readonly errorType: MonzoErrorType;
  readonly retryAfter?: string;

  constructor(
    message: string,
    errorType: MonzoErrorType = "unknown",
    options?: { retryAfter?: string },
  ) {
    super(message);
    this.name = "MonzoError";
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
    throw new MonzoError(`${label} must be a valid URL.`, "bad_request");
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new MonzoError(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
      "bad_request",
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new MonzoError(
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

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  return scalar(record.message ?? record.error_description ?? record.error);
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

function requestsOlderHistory(startTimestamp: string, endTimestamp: string) {
  const start = Date.parse(startTimestamp);
  const end = Date.parse(endTimestamp);
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < end - 90 * 24 * 60 * 60 * 1_000
  );
}

export interface MonzoClientOptions {
  accessToken: string;
  baseUrl?: string;
  allowedHosts?: readonly string[];
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  minRequestIntervalMs?: number;
}

export class MonzoClient {
  private readonly accessToken: string;
  private readonly baseUrl: URL;
  private readonly allowedHosts?: readonly string[];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly signal?: AbortSignal;
  private readonly minRequestIntervalMs: number;
  private lastRequestAt = 0;

  constructor(options: MonzoClientOptions) {
    this.accessToken = options.accessToken;
    this.allowedHosts = options.allowedHosts;
    this.baseUrl = assertSafeUrl(
      options.baseUrl?.trim() || DEFAULT_BASE_URL,
      this.allowedHosts,
      "Monzo base URL",
    );
    const request = options.fetch ?? globalThis.fetch;
    if (!request) {
      throw new MonzoError(
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
      ? assertSafeUrl(pathOrUrl, this.allowedHosts, "Monzo URL")
      : new URL(pathOrUrl.replace(/^\/+/, ""), `${this.baseUrl.origin}/`);
    assertSafeUrl(url.toString(), this.allowedHosts, "Monzo URL");
    if (url.origin !== this.baseUrl.origin) {
      throw new MonzoError(
        "Monzo redirects must remain on the configured origin.",
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
        if (this.signal?.aborted) throw error;
        throw new MonzoError(
          `Could not reach ${current.toString()} (${describeError(error) || "fetch failed"}).`,
          "request_failed",
        );
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new MonzoError(
            `Monzo redirected from ${current.toString()} without a Location header.`,
            "fetch_failed",
          );
        }
        current = this.resolveUrl(new URL(location, current).toString());
        continue;
      }
      return response;
    }
    throw new MonzoError(
      `Monzo redirected too many times (last URL ${current.toString()}).`,
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
          throw new MonzoError(
            "Failed to parse Monzo API response.",
            "fetch_failed",
          );
        }
        body = text;
      }
    }
    if (response.ok) return body;

    const detail = errorDetail(body);
    if (response.status === 400) {
      throw new MonzoError(
        detail
          ? `Bad request to Monzo API: ${detail}`
          : "Bad request to Monzo API.",
        "bad_request",
      );
    }
    if (response.status === 401) {
      throw new MonzoError(
        "Monzo access token is invalid or expired. Re-authorize in the Monzo API Playground and replace MONZO_ACCESS_TOKEN.",
        "unauthorized",
      );
    }
    if (response.status === 403) {
      throw new MonzoError(
        detail
          ? `Monzo access is forbidden: ${detail}`
          : "Monzo access is forbidden. Approve access in the Monzo app and try again.",
        "access_forbidden",
      );
    }
    if (response.status === 404) {
      throw new MonzoError(
        detail
          ? `Monzo resource not found: ${detail}`
          : "Monzo resource not found.",
        "not_found",
      );
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") ?? undefined;
      throw new MonzoError(
        retryAfter
          ? `Monzo rate limit exceeded. Retry after ${retryAfter}.`
          : "Monzo rate limit exceeded. Try again later.",
        "rate_limited",
        { retryAfter },
      );
    }
    throw new MonzoError(
      detail
        ? `Monzo API request failed with status ${response.status}: ${detail}`
        : `Monzo API request failed with status ${response.status}.`,
      "fetch_failed",
    );
  }

  async getAccounts(): Promise<MonzoAccount[]> {
    const body = (await this.get("accounts")) as { accounts?: unknown };
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    return accounts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const id = scalar(record.id);
      if (!id) return [];
      const paymentDetails = objectRecord(
        objectRecord(record.payment_details)?.locale_uk,
      );
      return [
        {
          id,
          created: scalar(record.created),
          accountType: scalar(record.type ?? record.account_type),
          ownerType: scalar(record.owner_type),
          isFlex: boolean(record.is_flex),
          productType: scalar(record.product_type),
          sortCode: scalar(record.sort_code),
          accountNumber: scalar(record.account_number),
          paymentDetails: paymentDetails
            ? {
                sortCode: scalar(paymentDetails.sort_code),
                accountNumber: scalar(paymentDetails.account_number),
              }
            : undefined,
          closed: boolean(record.closed),
        } satisfies MonzoAccount,
      ];
    });
  }

  async getBalance(accountId: string): Promise<MonzoBalance> {
    const body = (await this.get("balance", { account_id: accountId })) as {
      currency?: unknown;
    };
    const currency = scalar(body?.currency)?.toUpperCase();
    if (!currency) {
      throw new MonzoError(
        `Monzo balance for account ${accountId} is missing its currency.`,
        "fetch_failed",
      );
    }
    return { currency };
  }

  async getTransactionPage(options: {
    accountId: string;
    startTimestamp: string;
    endTimestamp: string;
    since?: string;
    limit?: number;
  }): Promise<MonzoTransactionPage> {
    try {
      const body = (await this.get("transactions", {
        account_id: options.accountId,
        since: options.since ?? options.startTimestamp,
        before: options.endTimestamp,
        limit: String(options.limit ?? DEFAULT_PAGE_SIZE),
        "expand[]": "merchant",
      })) as { transactions?: unknown };
      return {
        transactions: Array.isArray(body?.transactions)
          ? body.transactions.filter(
              (item): item is MonzoTransaction =>
                !!item && typeof item === "object",
            )
          : [],
      };
    } catch (error) {
      if (
        error instanceof MonzoError &&
        ["bad_request", "access_forbidden"].includes(error.errorType) &&
        requestsOlderHistory(options.startTimestamp, options.endTimestamp)
      ) {
        throw new MonzoError(
          `${error.message} Monzo only allows transaction history older than 90 days for about five minutes after authentication; re-authorize and run the initial sync immediately.`,
          error.errorType,
        );
      }
      throw error;
    }
  }
}
