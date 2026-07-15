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
  endpoint: string;
  /** Optional host allowlist; host names only, without paths or schemes. */
  allowedHosts?: string[];
  secretRef: string;
  recordsPath?: string;
  query?: Record<string, string>;
  pagination?: {
    cursorQueryParam: string;
    nextCursorPath: string;
  };
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

function safeEndpoint(config: JsonApiSourceConfig) {
  const url = new URL(config.endpoint);
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "JSON API sources must use HTTPS (HTTP is allowed only for localhost).",
    );
  }
  const allowedHosts = config.allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    allowedHosts?.length &&
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw new Error(
      `JSON API endpoint host ${url.hostname} is not in this source's allowlist.`,
    );
  }
  return url;
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
          response = await request(url, {
            method: "GET",
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/json",
            },
            redirect: "error",
            signal: context.signal,
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
        status: statusValue === "pending" ? "pending" : "posted",
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
