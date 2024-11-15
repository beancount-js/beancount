import { md5 } from "@beancount-js/parser";
import { storageSyncedStore } from "./storage";
import { z } from "zod";

export function queryHash(query: string) {
  query = query.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();
  if (!query) {
    return "";
  }
  return md5(query);
}

const queryHistorySchema = z.object({
  query: z.string(),
  hash: z.string(),
});
export type QueryHistory = z.infer<typeof queryHistorySchema>;

export function useQueryHistory(filename: string) {
  const { update, set, subscribe } = storageSyncedStore<Array<QueryHistory>>(
    `query-history/${filename.replaceAll(/.*\//g, "")}`,
    () => [],
    z.array(queryHistorySchema),
  );

  /** The query shell history. */
  return {
    subscribe,
    /** Completely clear the history. */
    clear(): void {
      set([]);
    },
    /** Add a new entry to the query history (this does avoid duplicates). */
    add(query: string): void {
      const hash = queryHash(query);
      if (hash) {
        update((hist) => [
          { hash, query },
          ...hist.filter((q) => q.hash !== hash),
        ]);
      }
    },
    /** Remove a query string from the query history. */
    remove(hash: string): void {
      if (hash) {
        update((hist) => {
          return (hist || []).filter((item) => item.hash !== hash);
        });
      }
    },

    removeQuery(query: string): void {
      const hash = queryHash(query);
      if (hash) {
        update((hist) => (hist || []).filter((item) => item.hash !== hash));
      }
    },
  };
}
