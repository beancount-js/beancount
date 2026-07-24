import { formatDate } from "@beancount-js/parser";
import type { DateTime } from "luxon";
import {
  buildLedgerHref,
  ledgerStemForPath,
  splitViewAndQuery,
} from "./lib/ledger-route";
import { getStudioRouteEnv } from "./lib/studio-route-env";

/** Get the URL string for one of Fava's reports (path-based ledger URL). */
export function urlFor(
  path: string,
  params?: Record<string, string | number | undefined>,
  ledgerPath?: string,
): string {
  const env = getStudioRouteEnv();
  const raw = path.startsWith("#") ? path.slice(1) : path;
  const { viewPath, query } = splitViewAndQuery(
    raw.startsWith("/") ? raw : `/${raw}`,
  );
  const merged: Record<string, string | undefined> = { ...query };
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) merged[key] = value.toString();
    }
  }
  const ledgerStem = ledgerPath
    ? ledgerStemForPath(ledgerPath, env.availableLedgers)
    : env.ledgerStem;
  if (!env.projectId || !ledgerStem) {
    // Fallback during bootstrap before route env is ready
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined) search.set(key, value);
    }
    const q = search.toString();
    return q ? `${viewPath}?${q}` : viewPath;
  }
  return buildLedgerHref(env.projectId, ledgerStem, viewPath, merged);
}

/** URL for the account report. */
export function urlForAccount(
  account: string | null | undefined,
  params?: Record<string, string>,
  ledgerPath?: string,
) {
  if (!account) {
    return urlFor("/accounts", params, ledgerPath);
  }
  return urlFor(`/account/${account}`, params, ledgerPath);
}

export function urlForDate(
  date: Date | DateTime | null | undefined,
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
