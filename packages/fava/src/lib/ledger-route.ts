/** Path-based ledger + view URL helpers (replaces hash `?ledger=` routing). */

export const LEDGER_FILE_EXTENSIONS = [".beancount", ".bean", ".ledger"] as const;

/** Default view opened when selecting a ledger or omitting the view segment. */
export const DEFAULT_LEDGER_VIEW = "/dashboard";

/** Single-segment views (terminal path segment). */
export const STUDIO_VIEWS = new Set([
  "journal",
  "dashboard",
  "editor",
  "income-statement",
  "balance-sheet",
  "trial-balance",
  "holdings",
  "statistics",
  "query",
  "errors",
  "accounts",
  "records",
  "resource",
  "directives",
  "settings",
]);

/** Legacy hash view → URL segment */
export const HASH_VIEW_TO_SEGMENT: Record<string, string> = {
  "/": "balance-sheet",
  "/dashboard": "dashboard",
  "/editor": "editor",
  "/directives": "editor",
  "/income_statement": "income-statement",
  "/balance_sheet": "balance-sheet",
  "/trial_balance": "trial-balance",
  "/journal": "journal",
  "/holdings": "holdings",
  "/statistics": "statistics",
  "/query": "query",
  "/errors": "errors",
  "/accounts": "accounts",
  "/records": "records",
  "/resource": "resource",
  "/import/editor": "settings",
  "/import/accounts": "settings/accounts",
};

/** URL segment → internal hash-style view path used by components */
export const SEGMENT_TO_HASH_VIEW: Record<string, string> = {
  journal: "/journal",
  dashboard: "/dashboard",
  editor: "/editor",
  "income-statement": "/income_statement",
  "balance-sheet": "/balance_sheet",
  "trial-balance": "/trial_balance",
  holdings: "/holdings",
  statistics: "/statistics",
  query: "/query",
  errors: "/errors",
  accounts: "/accounts",
  records: "/records",
  resource: "/resource",
  directives: "/editor",
  settings: "/import/editor",
  "settings/accounts": "/import/accounts",
};

export type ParsedLedgerRoute = {
  /** URL ledger stem (may be extensionless). */
  ledgerStem: string;
  /** Internal view path, e.g. `/journal`, `/account/Assets:Checking`. */
  viewPath: string;
  /** URL view segment(s), e.g. `journal` or `account/Assets:Checking`. */
  viewSegment: string;
  params: Record<string, string>;
};

function stripExtension(path: string) {
  const lower = path.toLowerCase();
  for (const ext of LEDGER_FILE_EXTENSIONS) {
    if (lower.endsWith(ext)) return path.slice(0, -ext.length);
  }
  return path;
}

export function hasLedgerExtension(path: string) {
  const lower = path.toLowerCase();
  return LEDGER_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Resolve a URL ledger stem against known ledger files.
 * Prefers exact match, then unique extensionless match.
 */
export function resolveLedgerPath(
  stem: string,
  available: readonly string[],
): string | null {
  const normalized = stem.replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;
  if (available.includes(normalized)) return normalized;

  if (hasLedgerExtension(normalized)) return null;

  const matches = available.filter(
    (path) => stripExtension(path) === normalized,
  );
  if (matches.length === 1) return matches[0]!;
  return null;
}

/** Prefer extensionless stem when it uniquely identifies the ledger. */
export function ledgerStemForPath(
  canonicalPath: string,
  available: readonly string[],
) {
  const stem = stripExtension(canonicalPath);
  const matches = available.filter((path) => stripExtension(path) === stem);
  return matches.length === 1 ? stem : canonicalPath;
}

/**
 * Peel view (+ account) from the right of catch-all segments.
 * Remaining left segments form the ledger stem.
 */
export function parseLedgerAndView(
  segments: readonly string[],
): ParsedLedgerRoute | null {
  const parts = segments.map((part) => decodeURIComponent(part)).filter(Boolean);
  if (!parts.length) return null;

  // settings/accounts (two-segment view)
  if (parts.length >= 2 && parts.at(-2) === "settings" && parts.at(-1) === "accounts") {
    const ledgerParts = parts.slice(0, -2);
    if (!ledgerParts.length) return null;
    return {
      ledgerStem: ledgerParts.join("/"),
      viewPath: "/import/accounts",
      viewSegment: "settings/accounts",
      params: {},
    };
  }

  // account/<name>
  if (parts.length >= 2 && parts.at(-2) === "account") {
    const account = parts.at(-1)!;
    const ledgerParts = parts.slice(0, -2);
    if (!ledgerParts.length) return null;
    return {
      ledgerStem: ledgerParts.join("/"),
      viewPath: `/account/${account}`,
      viewSegment: `account/${account}`,
      params: { account },
    };
  }

  const last = parts.at(-1)!;
  if (STUDIO_VIEWS.has(last)) {
    const ledgerParts = parts.slice(0, -1);
    if (!ledgerParts.length) return null;
    const viewPath = SEGMENT_TO_HASH_VIEW[last] ?? `/${last}`;
    return {
      ledgerStem: ledgerParts.join("/"),
      viewPath,
      viewSegment: last,
      params: {},
    };
  }

  // No view → default dashboard
  return {
    ledgerStem: parts.join("/"),
    viewPath: DEFAULT_LEDGER_VIEW,
    viewSegment: "dashboard",
    params: {},
  };
}

/** Map an internal view path (`/income_statement`, `/account/X`) to URL segments. */
export function viewPathToSegments(viewPath: string): string[] {
  const normalized = viewPath.split("?")[0] ?? viewPath;
  const clean = normalized.replace(/\/+$/, "") || "/";

  if (clean.startsWith("/account/")) {
    const account = clean.slice("/account/".length).replace(/\/+$/, "");
    return ["account", account];
  }

  const mapped = HASH_VIEW_TO_SEGMENT[clean];
  if (mapped) return mapped.split("/");

  // Fallback: strip leading slash, underscore → kebab
  return [
    clean
      .replace(/^\//, "")
      .replaceAll("_", "-")
      .replaceAll("/", "-") || "journal",
  ];
}

export function buildLedgerPathname(
  projectId: string,
  ledgerStem: string,
  viewPath: string,
): string {
  const viewSegments = viewPathToSegments(viewPath);
  const ledgerSegments = ledgerStem.split("/").filter(Boolean).map(encodeURIComponent);
  const encodedView = viewSegments.map((segment, index) => {
    // Keep account colons readable but safely encoded
    if (viewSegments[0] === "account" && index === 1) {
      return encodeURIComponent(segment);
    }
    return encodeURIComponent(segment);
  });
  const base = `/${encodeURIComponent(projectId)}/ledger/${[...ledgerSegments, ...encodedView].join("/")}`;
  return base.endsWith("/") ? base : `${base}/`;
}

export function buildLedgerHref(
  projectId: string,
  ledgerStem: string,
  viewPath: string,
  search?: string | URLSearchParams | Record<string, string | undefined>,
) {
  let path = buildLedgerPathname(projectId, ledgerStem, viewPath);
  // trailingSlash always — SvelteKit may add it; keep without forcing double
  path = path.replace(/\/+$/, "") + "/";

  let query = "";
  if (typeof search === "string") {
    query = search.startsWith("?") ? search.slice(1) : search;
  } else if (search instanceof URLSearchParams) {
    query = search.toString();
  } else if (search) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined && value !== "") params.set(key, value);
    }
    query = params.toString();
  }
  return query ? `${path}?${query}` : path;
}

/** Parse internal view path + optional query from a hash-style path. */
export function splitViewAndQuery(path: string): {
  viewPath: string;
  query: Record<string, string>;
} {
  const raw = path.replace(/^#/, "");
  const [pathname = "/", search = ""] = raw.includes("?")
    ? (() => {
        const index = raw.indexOf("?");
        return [raw.slice(0, index) || "/", raw.slice(index + 1)] as const;
      })()
    : ([raw || "/", ""] as const);
  const query: Record<string, string> = {};
  if (search) {
    for (const [key, value] of new URLSearchParams(search)) {
      query[key] = value;
    }
  }
  const viewPath = pathname.endsWith("/") && pathname.length > 1
    ? pathname.replace(/\/+$/, "")
    : pathname;
  return { viewPath: viewPath.startsWith("/") ? viewPath : `/${viewPath}`, query };
}

/**
 * Convert a legacy hash URL (`#/journal?ledger=a/b.beancount`) into a path URL.
 */
export function hashUrlToLedgerHref(
  projectId: string,
  hash: string,
  availableLedgers: readonly string[],
  fallbackLedger: string,
): string | null {
  if (!hash || hash === "#") return null;
  const { viewPath, query } = splitViewAndQuery(hash);
  const ledgerParam = query.ledger;
  delete query.ledger;
  const stemSource = ledgerParam || fallbackLedger;
  const resolved =
    resolveLedgerPath(stemSource, availableLedgers) ??
    (availableLedgers.includes(stemSource) ? stemSource : fallbackLedger);
  const stem = ledgerStemForPath(resolved, availableLedgers);
  return buildLedgerHref(projectId, stem, viewPath, query);
}
