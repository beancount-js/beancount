import type {
  SourceContext,
  SourcePage,
  SourcePlugin,
} from "@beancount-js/beangulp";
import { MonzoClient, MonzoError } from "./client";
import { monzoAccountDisplayName } from "./account-label";
import type { MonzoConfig, MonzoTransaction } from "./types";
import {
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_RECORDS,
  DEFAULT_PAGE_SIZE,
} from "./types";

async function resolveClient(config: MonzoConfig, context: SourceContext) {
  if (!config.secretRef?.trim()) {
    throw new MonzoError(
      "Monzo needs an access token (or env: reference).",
      "bad_request",
    );
  }
  const token = await context.resolveSecret?.(config.secretRef);
  if (!token) {
    throw new MonzoError(
      `Unable to resolve credential ${config.secretRef}.`,
      "unauthorized",
    );
  }
  return new MonzoClient({
    accessToken: token,
    baseUrl: config.baseUrl,
    allowedHosts: config.allowedHosts,
    fetch: context.fetch,
    signal: context.signal,
  });
}

function settled(items: readonly MonzoTransaction[]) {
  return items.filter(
    (item) => typeof item.settled === "string" && item.settled.trim(),
  );
}

function transactionId(value: MonzoTransaction | undefined) {
  return typeof value?.id === "string"
    ? value.id.trim() || undefined
    : undefined;
}

export class MonzoSource
  implements SourcePlugin<MonzoConfig, MonzoTransaction>
{
  readonly kind = "monzo";

  async *read(
    config: MonzoConfig,
    context: SourceContext,
  ): AsyncIterable<SourcePage<MonzoTransaction>> {
    const accountId =
      typeof context.fetchContext?.accountId === "string"
        ? context.fetchContext.accountId
        : undefined;
    const startTimestamp =
      typeof context.fetchContext?.startTimestamp === "string"
        ? context.fetchContext.startTimestamp
        : undefined;
    const endTimestamp =
      typeof context.fetchContext?.endTimestamp === "string"
        ? context.fetchContext.endTimestamp
        : undefined;
    if (!accountId || !startTimestamp || !endTimestamp) {
      throw new MonzoError(
        "Monzo sync needs an account and a prepared fetch window.",
        "bad_request",
      );
    }

    const client = await resolveClient(config, context);
    const maxRecords = context.maxRecords ?? DEFAULT_MAX_RECORDS;
    const maxPages = context.maxPages ?? DEFAULT_MAX_PAGES;
    let pageCount = 0;
    let recordCount = 0;
    let since: string | undefined;
    const seenCursors = new Set<string>();

    while (true) {
      const page = await client.getTransactionPage({
        accountId,
        startTimestamp,
        endTimestamp,
        since,
        limit: DEFAULT_PAGE_SIZE,
      });
      pageCount += 1;
      const records = settled(page.transactions);
      if (recordCount + records.length > maxRecords) {
        throw new MonzoError(
          `Monzo returned more than ${maxRecords} settled transactions; choose a later initial sync date.`,
          "fetch_failed",
        );
      }
      recordCount += records.length;
      yield { records };

      if (page.transactions.length < DEFAULT_PAGE_SIZE) return;
      if (pageCount >= maxPages) {
        throw new MonzoError(
          `Monzo pagination exceeded ${maxPages} pages; choose a later initial sync date.`,
          "fetch_failed",
        );
      }
      const next = transactionId(page.transactions.at(-1));
      if (!next) {
        throw new MonzoError(
          "Monzo returned a full transaction page without a final transaction id.",
          "fetch_failed",
        );
      }
      if (seenCursors.has(next)) {
        throw new MonzoError(
          "Monzo returned a repeated transaction cursor.",
          "fetch_failed",
        );
      }
      seenCursors.add(next);
      since = next;
    }
  }
}

export async function discoverMonzoAccounts(
  config: MonzoConfig,
  context: SourceContext,
) {
  const client = await resolveClient(config, context);
  const discovered = [];
  for (const account of await client.getAccounts()) {
    const balance = await client.getBalance(account.id);
    discovered.push({
      id: account.id,
      name: monzoAccountDisplayName(account),
      currency: balance.currency,
      institutionName: "Monzo Bank",
      closed: account.closed,
    });
  }
  return discovered;
}
