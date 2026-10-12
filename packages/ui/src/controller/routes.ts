import type { BeancountRoute } from "./contracts";
export const ledgerDestinations = [
  ["/dashboard", "Dashboard"],
  ["/editor", "Editor"],
  ["/income_statement", "Income Statement"],
  ["/balance_sheet", "Balance Sheet"],
  ["/trial_balance", "Trial Balance"],
  ["/journal", "Journal"],
  ["/holdings", "Holdings"],
  ["/statistics", "Statistics"],
  ["/query", "Query"],
  ["/accounts", "Accounts"],
  ["/errors", "Errors"],
] as const;
export const settingsDestinations = [
  ["/records", "Records"],
  ["/import/editor", "Sources"],
  ["/import/accounts", "Linked Accounts"],
  ["/import/merchants", "Review Merchants"],
  ["/import/manage-merchants", "Manage Merchants"],
  ["/import/brands", "Brand Match"],
  ["/import/history", "Import History"],
  ["/import/rules", "Rules"],
] as const;
export function parseRoute(input: string): BeancountRoute {
  const url = new URL(
    input.replace(/^#/, "") || "/dashboard",
    "http://beancount.invalid",
  );
  const path = url.pathname.replace(/\/$/, "") || "/dashboard";
  const params: Record<string, string> = {};
  if (path.startsWith("/account/"))
    params.account = decodeURIComponent(path.slice(9));
  if (path.startsWith("/import/history/"))
    params.runId = decodeURIComponent(path.slice(16));
  return { path, params, query: Object.fromEntries(url.searchParams) };
}
export function routeTitle(route: BeancountRoute) {
  return (
    [...ledgerDestinations, ...settingsDestinations].find(
      ([path]) => path === route.path,
    )?.[1] ??
    (route.params.account
      ? `Account: ${route.params.account}`
      : "Beancount Studio")
  );
}
