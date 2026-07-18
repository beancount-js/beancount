import { jsonApiAccountSourceId } from "@beancount-js/beangulp";
import type { IngestionSource } from "./types";

export type IngestionRunSourceDisplay = {
  /** Friendly name supplied by the connection or linked-account configuration. */
  title: string;
  /** Ledger account whose configured appearance should be shown in the avatar. */
  sourceAccount?: string;
};

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
        sourceAccount: account.sourceAccount.trim() || undefined,
      };
    }
  }

  return { title: runSourceId };
}
