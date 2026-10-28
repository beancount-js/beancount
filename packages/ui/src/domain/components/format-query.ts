import { format } from "sql-formatter";

/** BQL also accepts commands and incomplete drafts outside SQL's grammar. */
export function formatQueryText(query: string): string {
  if (!query.trim()) return "";
  try {
    return format(query, { language: "postgresql" });
  } catch {
    return query;
  }
}
