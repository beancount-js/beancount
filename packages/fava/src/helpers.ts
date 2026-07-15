import { formatDate } from "@beancount-js/parser";
import { buildLedgerHref, splitViewAndQuery } from "./lib/ledger-route";
import { getStudioRouteEnv } from "./lib/studio-route-env";

/** Get the URL string for one of Fava's reports (path-based ledger URL). */
export function urlFor(
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const env = getStudioRouteEnv();
  const raw = path.startsWith("#") ? path.slice(1) : path;
  const { viewPath, query } = splitViewAndQuery(raw.startsWith("/") ? raw : `/${raw}`);
  const merged: Record<string, string | undefined> = { ...query };
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) merged[key] = value.toString();
    }
  }
  if (!env.projectId || !env.ledgerStem) {
    // Fallback during bootstrap before route env is ready
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined) search.set(key, value);
    }
    const q = search.toString();
    return q ? `${viewPath}?${q}` : viewPath;
  }
  return buildLedgerHref(env.projectId, env.ledgerStem, viewPath, merged);
}

/** URL for the account report. */
export function urlForAccount(
  account: string | null | undefined,
  params?: Record<string, string>,
) {
  if (!account) {
    return urlFor("/accounts", params);
  }
  return urlFor(`/account/${account}`, params);
}

export function urlForDate(
  date: Date | null | undefined,
  params?: Record<string, string>,
) {
  if (!date) {
    return "#";
  }
  return urlFor("/balance_sheet", {
    ...(params || {}),
    query: formatDate(date),
  });
}
