import type {
  SourceContext,
  SourcePage,
  SourcePlugin,
} from "@beancount-js/beangulp";
import { LunchflowClient, LunchflowError } from "./client";
import type { LunchflowConfig, LunchflowTransaction } from "./types";

async function resolveClient(
  config: LunchflowConfig,
  context: SourceContext,
): Promise<LunchflowClient> {
  if (!config.secretRef?.trim()) {
    throw new LunchflowError(
      "Lunch Flow needs an API key (or env: reference).",
      "bad_request",
    );
  }
  const token = await context.resolveSecret?.(config.secretRef);
  if (!token) {
    throw new LunchflowError(
      `Unable to resolve credential ${config.secretRef}.`,
      "unauthorized",
    );
  }
  return new LunchflowClient({
    apiKey: token,
    baseUrl: config.baseUrl,
    allowedHosts: config.allowedHosts,
    fetch: context.fetch,
    signal: context.signal,
  });
}

export class LunchflowSource
  implements SourcePlugin<LunchflowConfig, LunchflowTransaction>
{
  readonly kind = "lunchflow";

  async *read(
    config: LunchflowConfig,
    context: SourceContext,
  ): AsyncIterable<SourcePage<LunchflowTransaction>> {
    const accountId =
      typeof context.fetchContext?.accountId === "string"
        ? context.fetchContext.accountId
        : undefined;
    if (!accountId?.trim()) {
      throw new LunchflowError(
        "Lunch Flow sync needs a linked account id.",
        "bad_request",
      );
    }
    const startDate =
      typeof context.fetchContext?.startDate === "string"
        ? context.fetchContext.startDate
        : undefined;
    const includePending = context.fetchContext?.includePending !== false;

    const client = await resolveClient(config, context);
    const records = await client.getAccountTransactions(accountId, {
      startDate,
      includePending,
    });
    const maxRecords = context.maxRecords;
    const page =
      maxRecords != null && maxRecords >= 0
        ? records.slice(0, maxRecords)
        : records;
    yield { records: page };
  }
}

export async function discoverLunchflowAccounts(
  config: LunchflowConfig,
  context: SourceContext,
) {
  const client = await resolveClient(config, context);
  return client.getAccounts();
}
