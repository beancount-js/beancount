import type {
  SourceContext,
  SourcePage,
  SourcePlugin,
} from "@beancount-js/beangulp";
import { StarlingClient, StarlingError } from "./client";
import type {
  StarlingConfig,
  StarlingFeedItem,
  StarlingFetchMode,
} from "./types";
import { DEFAULT_MAX_PAGES, DEFAULT_MAX_RECORDS } from "./types";

async function resolveClient(config: StarlingConfig, context: SourceContext) {
  if (!config.secretRef?.trim()) {
    throw new StarlingError(
      "Starling needs an access token (or env: reference).",
      "bad_request",
    );
  }
  const token = await context.resolveSecret?.(config.secretRef);
  if (!token) {
    throw new StarlingError(
      `Unable to resolve credential ${config.secretRef}.`,
      "unauthorized",
    );
  }
  return new StarlingClient({
    accessToken: token,
    baseUrl: config.baseUrl,
    allowedHosts: config.allowedHosts,
    fetch: context.fetch,
    signal: context.signal,
  });
}

function settled(items: readonly StarlingFeedItem[]) {
  return items.filter((item) => item.status === "SETTLED");
}

export class StarlingSource
  implements SourcePlugin<StarlingConfig, StarlingFeedItem>
{
  readonly kind = "starling";

  async *read(
    config: StarlingConfig,
    context: SourceContext,
  ): AsyncIterable<SourcePage<StarlingFeedItem>> {
    const accountId =
      typeof context.fetchContext?.accountId === "string"
        ? context.fetchContext.accountId
        : undefined;
    const mode = context.fetchContext?.mode as StarlingFetchMode | undefined;
    const startTimestamp =
      typeof context.fetchContext?.startTimestamp === "string"
        ? context.fetchContext.startTimestamp
        : undefined;
    const endTimestamp =
      typeof context.fetchContext?.endTimestamp === "string"
        ? context.fetchContext.endTimestamp
        : undefined;
    if (!accountId || !mode || !startTimestamp || !endTimestamp) {
      throw new StarlingError(
        "Starling sync needs an account and a prepared fetch window.",
        "bad_request",
      );
    }

    const client = await resolveClient(config, context);
    const account = (await client.getAccounts()).find(
      (item) => item.accountUid === accountId,
    );
    if (!account) {
      throw new StarlingError(
        `Starling account ${accountId} is no longer accessible.`,
        "not_found",
      );
    }

    const maxRecords = context.maxRecords ?? DEFAULT_MAX_RECORDS;
    if (mode === "changes") {
      const records = settled(
        await client.getChangedTransactions({
          accountUid: account.accountUid,
          categoryUid: account.defaultCategory,
          changesSince: startTimestamp,
        }),
      );
      if (records.length > maxRecords) {
        throw new StarlingError(
          `Starling returned more than ${maxRecords} settled transactions; narrow the sync window.`,
          "fetch_failed",
        );
      }
      yield { records };
      return;
    }

    const maxPages = context.maxPages ?? DEFAULT_MAX_PAGES;
    let pageCount = 0;
    let recordCount = 0;
    let nextUrl: string | undefined;
    const seenPages = new Set<string>();
    do {
      const page = await client.getTransactionPage({
        accountUid: account.accountUid,
        categoryUid: account.defaultCategory,
        minTransactionTimestamp: startTimestamp,
        maxTransactionTimestamp: endTimestamp,
        nextUrl,
      });
      pageCount += 1;
      const records = settled(page.feedItems);
      if (recordCount + records.length > maxRecords) {
        throw new StarlingError(
          `Starling returned more than ${maxRecords} settled transactions; choose a later initial sync date.`,
          "fetch_failed",
        );
      }
      recordCount += records.length;
      yield { records };

      if (!page.next) return;
      if (pageCount >= maxPages) {
        throw new StarlingError(
          `Starling pagination exceeded ${maxPages} pages; choose a later initial sync date.`,
          "fetch_failed",
        );
      }
      if (seenPages.has(page.next)) {
        throw new StarlingError(
          "Starling returned a repeated pagination link.",
          "fetch_failed",
        );
      }
      seenPages.add(page.next);
      nextUrl = page.next;
    } while (nextUrl);
  }
}

export async function discoverStarlingAccounts(
  config: StarlingConfig,
  context: SourceContext,
) {
  const client = await resolveClient(config, context);
  return (await client.getAccounts()).map((account) => ({
    id: account.accountUid,
    name: account.name,
    currency: account.currency,
    institutionName: "Starling Bank",
    status: account.accountType,
  }));
}
