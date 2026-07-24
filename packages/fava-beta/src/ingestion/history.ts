import { jsonApiAccountSourceId } from "@beancount-js/beangulp";
import type { IngestionSource } from "./types";

export type IngestionRunSourceDisplay = {
  /** Friendly name supplied by the connection or linked-account configuration. */
  title: string;
  /** Identity for the connection that supplied the run. */
  sourceId: string;
  /** Friendly connection name for the source chip. */
  sourceName: string;
  /** Optional merchant profile used to render the configured source avatar. */
  sourceMerchantId?: string;
  /** Ledger account whose configured appearance should be shown in the avatar. */
  sourceAccount?: string;
};

type IngestionHistoryRow = {
  id: string;
  sourceId: string;
  reviewState: "pending" | "completed";
};

/** Select the destination that matches the work still available for a run. */
export function ingestionHistoryRowPath(run: IngestionHistoryRow) {
  if (run.reviewState === "completed") return `/import/history/${run.id}`;
  return `/records?${new URLSearchParams({
    sourceId: run.sourceId.split(":")[0] ?? run.sourceId,
    runId: run.id,
  })}`;
}

/**
 * Resolve the user-facing identity for a historical run without losing access
 * to archives recorded before a source or linked account was removed.
 */
export function ingestionRunSourceDisplay(
  runSourceId: string,
  sources: readonly IngestionSource[],
): IngestionRunSourceDisplay {
  const source = sources.find((item) => item.id === runSourceId);
  if (source) {
    return {
      title: source.name.trim() || runSourceId,
      sourceId: source.id,
      sourceName: source.name.trim() || source.id,
      sourceMerchantId: source.merchantId,
      sourceAccount: source.sourceAccount?.trim() || undefined,
    };
  }

  for (const connection of sources) {
    const account = connection.accounts?.find(
      (item) => jsonApiAccountSourceId(connection.id, item.id) === runSourceId,
    );
    if (account) {
      return {
        title: account.name.trim() || connection.name.trim() || runSourceId,
        sourceId: connection.id,
        sourceName: connection.name.trim() || connection.id,
        sourceMerchantId: connection.merchantId,
        sourceAccount: account.sourceAccount.trim() || undefined,
      };
    }
  }

  const sourceId = runSourceId.split(":", 1)[0] ?? runSourceId;
  return {
    title: runSourceId,
    sourceId,
    sourceName: sourceId,
  };
}
