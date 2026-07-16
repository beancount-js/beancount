import type { LunchflowAccount, LunchflowTransaction } from "./types";
import { DEFAULT_BASE_URL } from "./types";

export type LunchflowErrorType =
  | "bad_request"
  | "unauthorized"
  | "access_forbidden"
  | "not_found"
  | "rate_limited"
  | "fetch_failed"
  | "request_failed"
  | "unknown";

export class LunchflowError extends Error {
  readonly errorType: LunchflowErrorType;

  constructor(message: string, errorType: LunchflowErrorType = "unknown") {
    super(message);
    this.name = "LunchflowError";
    this.errorType = errorType;
  }
}

function hostsAllowingWwwAlias(allowedHosts: readonly string[] | undefined) {
  if (!allowedHosts?.length) return undefined;
  const expanded = new Set<string>();
  for (const host of allowedHosts) {
    const normalized = host.trim().toLowerCase();
    if (!normalized) continue;
    expanded.add(normalized);
    if (normalized.startsWith("www.")) expanded.add(normalized.slice(4));
    else expanded.add(`www.${normalized}`);
  }
  return [...expanded];
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
    throw new LunchflowError(`${label} must be a valid URL.`, "bad_request");
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new LunchflowError(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
      "bad_request",
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new LunchflowError(
      `${label} host ${url.hostname} is not in this source's allowlist.`,
      "bad_request",
    );
  }
  return url;
}

function describeError(error: unknown, depth = 0): string {
  if (depth > 4 || error == null) return "";
  if (!(error instanceof Error)) return String(error);
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    const nested = describeError(cause, depth + 1);
    if (nested && !parts.includes(nested)) parts.push(nested);
  }
  return parts.join(": ");
}

async function fetchGet(options: {
  url: URL;
  headers: Record<string, string>;
  allowedHosts?: readonly string[];
  fetch: typeof globalThis.fetch;
  signal?: AbortSignal;
  label?: string;
}) {
  const redirectHosts = hostsAllowingWwwAlias(options.allowedHosts);
  let current = options.url;
  for (let hop = 0; hop < 5; hop += 1) {
    assertSafeUrl(
      current.toString(),
      redirectHosts,
      options.label ?? "Lunch Flow URL",
    );
    let response: Response;
    try {
      response = await options.fetch(current, {
        method: "GET",
        headers: options.headers,
        redirect: "manual",
        signal: options.signal,
      });
    } catch (error) {
      throw new LunchflowError(
        `Could not reach ${current.toString()} (${describeError(error) || "fetch failed"}).`,
        "request_failed",
      );
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new LunchflowError(
          `Lunch Flow redirected from ${current.toString()} without a Location header.`,
          "fetch_failed",
        );
      }
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new LunchflowError(
    `Lunch Flow redirected too many times (last URL ${current.toString()}).`,
    "fetch_failed",
  );
}

function handleResponseBody(status: number, body: string): unknown {
  if (status === 200) {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new LunchflowError(
        "Failed to parse Lunch Flow API response.",
        "fetch_failed",
      );
    }
  }
  if (status === 400) {
    throw new LunchflowError(
      `Bad request to Lunch Flow API: ${body}`,
      "bad_request",
    );
  }
  if (status === 401) {
    throw new LunchflowError("Invalid API key", "unauthorized");
  }
  if (status === 403) {
    throw new LunchflowError(
      "Access forbidden - check your API key permissions",
      "access_forbidden",
    );
  }
  if (status === 404) {
    throw new LunchflowError("Resource not found", "not_found");
  }
  if (status === 429) {
    throw new LunchflowError(
      "Rate limit exceeded. Please try again later.",
      "rate_limited",
    );
  }
  throw new LunchflowError(
    `Failed to fetch data: ${status} - ${body}`,
    "fetch_failed",
  );
}

export interface LunchflowClientOptions {
  apiKey: string;
  baseUrl?: string;
  allowedHosts?: readonly string[];
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export class LunchflowClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly allowedHosts?: readonly string[];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly signal?: AbortSignal;

  constructor(options: LunchflowClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.allowedHosts = options.allowedHosts;
    const request = options.fetch ?? globalThis.fetch;
    if (!request) {
      throw new LunchflowError(
        "No Fetch implementation is available.",
        "request_failed",
      );
    }
    this.fetchImpl = request;
    this.signal = options.signal;
  }

  private authHeaders() {
    return {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async get(path: string, query?: Record<string, string>) {
    const base = assertSafeUrl(
      `${this.baseUrl}/`,
      this.allowedHosts,
      "Lunch Flow base URL",
    );
    const url = new URL(
      path.replace(/^\/+/, ""),
      `${base.origin}${base.pathname}`,
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) url.searchParams.set(key, value);
      }
    }
    const response = await fetchGet({
      url,
      headers: this.authHeaders(),
      allowedHosts: this.allowedHosts,
      fetch: this.fetchImpl,
      signal: this.signal,
      label: "Lunch Flow URL",
    });
    const body = await response.text();
    return handleResponseBody(response.status, body);
  }

  async getAccounts(): Promise<LunchflowAccount[]> {
    const data = (await this.get("accounts")) as {
      accounts?: unknown;
      error?: string;
    };
    if (data?.error) {
      throw new LunchflowError(String(data.error), "fetch_failed");
    }
    const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
    return accounts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const id = record.id == null ? "" : String(record.id).trim();
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!id || !name) return [];
      return [
        {
          id,
          name,
          currency:
            typeof record.currency === "string" ? record.currency : undefined,
          institutionName:
            typeof record.institutionName === "string"
              ? record.institutionName
              : typeof record.institution_name === "string"
                ? record.institution_name
                : undefined,
          status: typeof record.status === "string" ? record.status : undefined,
          iban: typeof record.iban === "string" ? record.iban : undefined,
        } satisfies LunchflowAccount,
      ];
    });
  }

  async getAccountTransactions(
    accountId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      includePending?: boolean;
    },
  ): Promise<LunchflowTransaction[]> {
    const query: Record<string, string> = {};
    if (options?.startDate) query.start_date = options.startDate;
    if (options?.endDate) query.end_date = options.endDate;
    if (options?.includePending) query.include_pending = "true";

    const data = (await this.get(
      `accounts/${encodeURIComponent(accountId)}/transactions`,
      query,
    )) as { transactions?: unknown; error?: string };

    if (data?.error) {
      throw new LunchflowError(String(data.error), "fetch_failed");
    }
    const transactions = Array.isArray(data?.transactions)
      ? data.transactions
      : [];
    return transactions.filter(
      (item): item is LunchflowTransaction =>
        !!item && typeof item === "object",
    ) as LunchflowTransaction[];
  }
}
