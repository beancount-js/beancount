import type {
  BeancountOptions,
  Directive,
  LedgerError,
} from "@beancount-js/beancount";
import { normalizeColumns } from "./query/types";
import { expandShellQuery } from "./shell";
import { createDatabase } from "./sources/beancount";

export type QueryColumn = {
  name: string;
  type: unknown;
};

export type QueryResult = {
  data: Array<Record<string, unknown>>;
  columns: QueryColumn[];
  error?: string;
};

export function runBql(
  directives: Directive[],
  query: string,
  props: Partial<{
    options: BeancountOptions;
    errors: LedgerError[];
  }> = {},
): QueryResult {
  const trimmed = expandShellQuery(query.trim());
  if (!trimmed) {
    return { data: [], columns: [] };
  }
  try {
    const db = createDatabase(directives, props);
    const [columns, rows] = db.execute(trimmed);
    const normalized = normalizeColumns(columns);
    const data = rows.map((row: unknown[]) => {
      const record: Record<string, unknown> = {};
      normalized.forEach((col, index) => {
        if (col.name) {
          record[col.name] = row[index];
        }
      });
      return record;
    });
    return { data, columns: normalized };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Query failed");
    return { data: [], columns: [], error: message };
  }
}

export { createDatabase } from "./sources/beancount";
export type { Context } from "./query/Context";
