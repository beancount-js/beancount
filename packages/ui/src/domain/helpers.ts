import { formatDate } from "@beancount-js/parser";
import type { DateTime } from "luxon";
export function urlFor(
  path: string,
  params?: Record<string, string | number | undefined>,
) {
  const [base, query] = path.replace(/^#/, "").split("?");
  const search = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined) search.set(key, String(value));
  return `${base?.startsWith("/") ? base : `/${base ?? ""}`}${search.size ? `?${search}` : ""}`;
}
export function urlForAccount(
  account: string | null | undefined,
  params?: Record<string, string>,
) {
  return urlFor(account ? `/account/${account}` : "/accounts", params);
}
export function urlForDate(
  date: Date | DateTime | null | undefined,
  params?: Record<string, string>,
) {
  return date
    ? urlFor("/balance_sheet", { ...params, query: formatDate(date) })
    : "#";
}
