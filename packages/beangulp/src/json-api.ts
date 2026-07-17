import { DateTime } from "luxon";
import { md5 } from "@beancount-js/parser";
import type {
  JsonRecord,
  NormalizeContext,
  NormalizeResult,
  NormalizerPlugin,
  SourceContext,
  SourcePage,
  SourcePlugin,
} from "./types";

export interface JsonApiSourceConfig {
  /**
   * Full transactions URL for a standalone source.
   * Grouped connections use `baseUrl` instead and derive per-account endpoints.
   */
  endpoint?: string;
  /**
   * Provider API root for multi-account connections
   * (e.g. `https://lunchflow.app/api/v1`).
   */
  baseUrl?: string;
  /** Optional host allowlist; host names only, without paths or schemes. */
  allowedHosts?: string[];
  secretRef: string;
  /**
   * How the resolved secret is sent.
   * - `bearer` (default): `Authorization: Bearer <secret>`
   * - `x-api-key`: `X-API-Key: <secret>`
   */
  authScheme?: "bearer" | "x-api-key";
  recordsPath?: string;
  query?: Record<string, string>;
  pagination?: {
    cursorQueryParam: string;
    nextCursorPath: string;
  };
}

/** Linked bank account under a grouped JSON API connection. */
export interface JsonApiLinkedAccount {
  /** Remote provider account id. */
  id: string;
  name: string;
  sourceAccount: string;
  defaultCurrency?: string;
  /** Overrides the connection reconciliation priority for this account. */
  reconciliationPriority?: number;
}

export function isGroupedJsonApiSource(source: {
  accounts?: readonly unknown[] | undefined;
}): boolean {
  return Array.isArray(source.accounts);
}

/** Build `{baseUrl}/accounts/{id}/transactions`. */
export function jsonApiAccountTransactionsEndpoint(
  baseUrl: string,
  accountId: string,
) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/accounts/${encodeURIComponent(accountId)}/transactions`;
}

/** Stable ingest / cursor key for a nested account under a connection. */
export function jsonApiAccountSourceId(
  connectionId: string,
  accountId: string,
) {
  return `${connectionId}:${accountId}`;
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
    throw new Error(`${label} must be a valid URL.`);
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error(
      `${label} host ${url.hostname} is not in this source's allowlist.`,
    );
  }
  return url;
}

/** Flatten Error.cause chains so network failures are actionable in the UI. */
export function describeError(error: unknown, depth = 0): string {
  if (depth > 4 || error == null) return "";
  if (!(error instanceof Error)) {
    if (typeof error === "object") {
      const record = error as { message?: unknown; code?: unknown };
      const parts = [
        typeof record.message === "string" ? record.message : "",
        typeof record.code === "string" ? record.code : "",
      ].filter(Boolean);
      if (parts.length) return parts.join(": ");
    }
    return String(error);
  }
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string" && code && !parts.includes(code)) {
    parts.push(code);
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    const nested = describeError(cause, depth + 1);
    if (nested && !parts.includes(nested)) parts.push(nested);
  }
  return parts.join(": ");
}

function networkFetchError(url: URL, error: unknown) {
  const detail = describeError(error) || "fetch failed";
  return new Error(`Could not reach ${url.toString()} (${detail}).`);
}

/** Allow apex↔www redirects without opening arbitrary hosts. */
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

/**
 * GET with allowlisted redirects. Lunch Flow (and others) 308 from apex→www;
 * curl follows those by default, while `redirect: "error"` surfaces as "fetch failed".
 */
async function fetchJsonApiGet(options: {
  url: URL;
  headers: Record<string, string>;
  allowedHosts?: readonly string[];
  fetch: typeof globalThis.fetch;
  signal?: AbortSignal;
  label?: string;
}) {
  const request = options.fetch;
  const redirectHosts = hostsAllowingWwwAlias(options.allowedHosts);
  let current = options.url;
  for (let hop = 0; hop < 5; hop += 1) {
    assertSafeUrl(
      current.toString(),
      redirectHosts,
      options.label ?? "JSON API URL",
    );
    let response: Response;
    try {
      response = await request(current, {
        method: "GET",
        headers: options.headers,
        redirect: "manual",
        signal: options.signal,
      });
    } catch (error) {
      throw networkFetchError(current, error);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `JSON API redirected from ${current.toString()} without a Location header.`,
        );
      }
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error(
    `JSON API redirected too many times (last URL ${current.toString()}).`,
  );
}

export type DiscoveredJsonApiAccount = {
  id: string;
  name: string;
  currency?: string;
  institutionName?: string;
  status?: string;
  iban?: string;
  closed?: boolean;
};

/**
 * Discover remote accounts from `{baseUrl}/accounts` (or a custom path).
 * Secrets are resolved by the caller via `resolveSecret`.
 */
export async function discoverJsonApiAccounts(options: {
  baseUrl: string;
  secretRef: string;
  authScheme?: "bearer" | "x-api-key";
  allowedHosts?: readonly string[];
  accountsPath?: string;
  resolveSecret: (reference: string) => Promise<string | undefined>;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}): Promise<DiscoveredJsonApiAccount[]> {
  if (!options.secretRef.trim()) {
    throw new Error("An API key (or env: reference) is required.");
  }
  const base = assertSafeUrl(
    options.baseUrl,
    options.allowedHosts,
    "JSON API base URL",
  );
  const path = (options.accountsPath ?? "accounts").replace(/^\/+/, "");
  const url = new URL(path, `${base.origin}${base.pathname.replace(/\/+$/, "")}/`);
  assertSafeUrl(url.toString(), options.allowedHosts, "JSON API accounts URL");

  const token = await options.resolveSecret(options.secretRef);
  if (!token) {
    throw new Error(`Unable to resolve credential ${options.secretRef}.`);
  }
  const request = options.fetch ?? globalThis.fetch;
  if (!request) {
    throw new Error("No Fetch implementation is available.");
  }

  const authHeaders: Record<string, string> =
    options.authScheme === "x-api-key"
      ? { "x-api-key": token }
      : { authorization: `Bearer ${token}` };
  const response = await fetchJsonApiGet({
    url,
    headers: {
      ...authHeaders,
      accept: "application/json",
    },
    allowedHosts: options.allowedHosts,
    fetch: request,
    signal: options.signal,
    label: "JSON API accounts URL",
  });
  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = (await response.text()).trim().slice(0, 280);
    } catch {
      /* ignore body read failures */
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        bodyText
          ? `Invalid API key or insufficient permissions (${bodyText}).`
          : "Invalid API key or insufficient permissions.",
      );
    }
    throw new Error(
      bodyText
        ? `Account discovery failed with status ${response.status}: ${bodyText}`
        : `Account discovery failed with status ${response.status}.`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Account discovery response was not valid JSON.");
  }

  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { accounts?: unknown })?.accounts)
      ? (body as { accounts: unknown[] }).accounts
      : null;
  if (!list) {
    throw new Error("Account discovery response did not include an accounts array.");
  }

  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = scalar(record.id);
    const name = scalar(record.name);
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        currency: scalar(record.currency),
        institutionName: scalar(record.institution_name ?? record.institutionName),
        status: scalar(record.status),
        iban: scalar(record.iban),
        closed: boolean(record.closed),
      } satisfies DiscoveredJsonApiAccount,
    ];
  });
}

export interface JsonMappingConfig {
  id?: string;
  date: string;
  amount: string;
  currency?: string;
  merchant?: string;
  payee?: string;
  narration?: string;
  status?: string;
  dateFormat?: string;
  amountSign?: "as-is" | "invert";
}

function valueAt(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path
    .replaceAll("[", ".")
    .replaceAll("]", "")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current && typeof current === "object") {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, value);
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function safeEndpoint(config: JsonApiSourceConfig) {
  if (!config.endpoint?.trim()) {
    throw new Error("JSON API sources need an endpoint URL.");
  }
  return assertSafeUrl(
    config.endpoint,
    config.allowedHosts,
    "JSON API endpoint",
  );
}

function retryDelay(response: Response | undefined, attempt: number) {
  const retryAfter = response?.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1_000, 10_000);
  return 150 * 2 ** attempt;
}

async function pause(delay: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** A server-safe bearer-token JSON API reader. The token is resolved at runtime only. */
export class JsonApiSource
  implements SourcePlugin<JsonApiSourceConfig, JsonRecord>
{
  readonly kind = "json-api";

  async *read(
    config: JsonApiSourceConfig,
    context: SourceContext,
  ): AsyncIterable<SourcePage<JsonRecord>> {
    if (!config.secretRef)
      throw new Error("A bearer-token secret reference is required.");
    // Validate the endpoint before consulting any credential provider.
    const endpoint = safeEndpoint(config);
    const token = await context.resolveSecret?.(config.secretRef);
    if (!token)
      throw new Error(`Unable to resolve credential ${config.secretRef}.`);
    const request = context.fetch ?? globalThis.fetch;
    if (!request)
      throw new Error(
        "No Fetch implementation is available for the JSON API source.",
      );

    let cursor = context.cursor;
    let pages = 0;
    let records = 0;
    const maxPages = context.maxPages ?? 100;
    const maxRecords = context.maxRecords ?? 10_000;

    while (pages < maxPages && records < maxRecords) {
      const url = new URL(endpoint);
      for (const [key, value] of Object.entries(config.query ?? {}))
        url.searchParams.set(key, value);
      if (cursor && config.pagination)
        url.searchParams.set(config.pagination.cursorQueryParam, cursor);

      let response: Response | undefined;
      let failure: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const authHeaders: Record<string, string> =
            config.authScheme === "x-api-key"
              ? { "x-api-key": token }
              : { authorization: `Bearer ${token}` };
          response = await fetchJsonApiGet({
            url,
            headers: {
              ...authHeaders,
              accept: "application/json",
            },
            allowedHosts: config.allowedHosts,
            fetch: request,
            signal: context.signal,
            label: "JSON API endpoint",
          });
          if (response.ok || (response.status !== 429 && response.status < 500))
            break;
          failure = new Error(
            `JSON API request failed with status ${response.status}.`,
          );
        } catch (error) {
          failure = error;
        }
        if (attempt < 2)
          await pause(retryDelay(response, attempt), context.signal);
      }
      if (!response?.ok) {
        throw failure instanceof Error
          ? failure
          : new Error("JSON API request failed.");
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("JSON API response was not valid JSON.");
      }
      const pageRecords = valueAt(body, config.recordsPath ?? "data");
      if (
        !Array.isArray(pageRecords) ||
        !pageRecords.every((item) => item && typeof item === "object")
      ) {
        throw new Error(
          `JSON API records path ${config.recordsPath ?? "data"} did not contain an array of objects.`,
        );
      }

      const remaining = Math.max(0, maxRecords - records);
      const page = pageRecords.slice(0, remaining) as JsonRecord[];
      records += page.length;
      pages += 1;
      const next = scalar(valueAt(body, config.pagination?.nextCursorPath));
      yield { records: page, nextCursor: next };
      if (
        !config.pagination ||
        !next ||
        page.length === 0 ||
        records >= maxRecords
      )
        return;
      cursor = next;
    }
  }
}

/** Maps a JSON record into the small, source-agnostic transaction shape used by the pipeline. */
export class JsonMappingNormalizer implements NormalizerPlugin<JsonRecord> {
  readonly kind = "json-mapping";

  constructor(readonly config: JsonMappingConfig) {}

  normalize(record: JsonRecord, context: NormalizeContext): NormalizeResult {
    const rawDate = scalar(valueAt(record, this.config.date));
    const rawAmount = scalar(valueAt(record, this.config.amount));
    const currency =
      scalar(valueAt(record, this.config.currency)) ?? context.defaultCurrency;
    if (!rawDate)
      return { ok: false, message: "Missing required transaction date." };
    if (
      !rawAmount ||
      !/^[+-]?\d+(?:\.\d+)?$/.test(rawAmount.replaceAll(",", ""))
    ) {
      return { ok: false, message: "Missing or invalid transaction amount." };
    }
    if (!currency)
      return { ok: false, message: "Missing transaction currency." };

    const parsedDate = this.config.dateFormat
      ? DateTime.fromFormat(rawDate, this.config.dateFormat)
      : DateTime.fromISO(rawDate, { zone: "utc" });
    if (!parsedDate.isValid)
      return { ok: false, message: "Invalid transaction date." };

    const externalId = scalar(valueAt(record, this.config.id));
    const merchant = scalar(valueAt(record, this.config.merchant));
    const payee = scalar(valueAt(record, this.config.payee)) ?? merchant;
    const narration =
      scalar(valueAt(record, this.config.narration)) ??
      merchant ??
      payee ??
      "Imported transaction";
    const statusValue = scalar(
      valueAt(record, this.config.status),
    )?.toLowerCase();
    const amount = rawAmount.replaceAll(",", "");
    const signedAmount =
      this.config.amountSign === "invert"
        ? amount.startsWith("-")
          ? amount.slice(1)
          : `-${amount}`
        : amount;
    const pending =
      statusValue === "pending" ||
      statusValue === "true" ||
      statusValue === "1";

    return {
      ok: true,
      transaction: {
        sourceId: context.sourceId,
        sourceAccount: context.sourceAccount,
        externalId,
        bookedAt: parsedDate.toISODate()!,
        amount: signedAmount,
        currency,
        merchant,
        payee,
        narration,
        status: pending ? "pending" : "posted",
        fetchedAt: context.fetchedAt,
        metadata: {
          raw_fingerprint: md5(JSON.stringify(record)),
        },
      },
    };
  }
}

/** Useful for file uploads and tests; records are already available in memory. */
export class ArraySource<Record>
  implements SourcePlugin<readonly Record[], Record>
{
  readonly kind = "array";

  async *read(config: readonly Record[]): AsyncIterable<SourcePage<Record>> {
    yield { records: config };
  }
}
