import type {
  SearchFilterSyntax,
  SearchFilterValue,
} from "@lapis/ui/forms";

export const LEDGER_SEARCH_SORTS = [
  "relevance",
  "dateDesc",
  "dateAsc",
  "title",
] as const;

export type LedgerSearchSort = (typeof LEDGER_SEARCH_SORTS)[number];

export const LEDGER_SEARCH_PARAM_KEYS = [
  "searchQ",
  "searchSort",
  "searchType",
  "searchAccount",
  "searchAccounts",
  "searchPayee",
  "searchPayees",
  "searchTag",
  "searchTags",
  "searchYear",
  "searchYears",
] as const;

export type LedgerSearchState = {
  query: string;
  sort: LedgerSearchSort;
  /** Selected types (URL: comma-separated `searchType`). */
  types: string[];
  /** Selected accounts (URL: comma-separated `searchAccounts`). */
  accounts: string[];
  /** Selected payees (URL: comma-separated `searchPayees`). */
  payees: string[];
  /** Selected tags (URL: comma-separated `searchTags`). */
  tags: string[];
  /** Selected years (URL: comma-separated `searchYears`). */
  years: string[];
};

export const DEFAULT_LEDGER_SEARCH_STATE: LedgerSearchState = {
  query: "",
  sort: "relevance",
  types: [],
  accounts: [],
  payees: [],
  tags: [],
  years: [],
};

const LEDGER_TEXT_OPERATORS = [":", "=", "!=", ">", ">=", "<", "<=", "~", "!~"];
const LEDGER_NUMBER_OPERATORS = LEDGER_TEXT_OPERATORS;
const LEDGER_DATE_OPERATORS = [":", "=", ">", ">=", "<", "<="];

function filterSyntaxValues(values: readonly string[]): SearchFilterValue[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = value.trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) return [];
    seen.add(key);
    return { value: normalized, apply: quoteFilterToken(normalized) };
  });
}

/** The discoverable filter-query syntax executed by the sidebar ledger search. */
export function createLedgerSearchFilterSyntax(values: {
  types: readonly string[];
  accounts: readonly string[];
  payees: readonly string[];
  tags: readonly string[];
  years: readonly string[];
}): SearchFilterSyntax {
  return {
    description:
      "Use a field, comparison, and value to narrow ledger directives. Plain words search directive text.",
    fields: [
      {
        name: "type",
        description: "Directive type.",
        operators: LEDGER_TEXT_OPERATORS,
        values: filterSyntaxValues(values.types),
      },
      {
        name: "account",
        description: "Any directive account.",
        operators: LEDGER_TEXT_OPERATORS,
        values: filterSyntaxValues(values.accounts),
      },
      {
        name: "payee",
        description: "Transaction payee.",
        operators: LEDGER_TEXT_OPERATORS,
        values: filterSyntaxValues(values.payees),
      },
      {
        name: "narration",
        description: "Transaction narration.",
        operators: LEDGER_TEXT_OPERATORS,
      },
      {
        name: "flag",
        description: "Transaction or posting flag.",
        aliases: [
          "tx.flag",
          "transaction.flag",
          "txn.flag",
          "posting.flag",
          "p.flag",
        ],
        operators: LEDGER_TEXT_OPERATORS,
      },
      {
        name: "tag",
        description: "Transaction tag.",
        operators: LEDGER_TEXT_OPERATORS,
        values: filterSyntaxValues(
          values.tags.map((tag) => tag.replace(/^#+/, "")),
        ),
      },
      {
        name: "link",
        description: "Transaction link.",
        operators: LEDGER_TEXT_OPERATORS,
      },
      {
        name: "amount",
        description: "Posting amount.",
        aliases: ["units"],
        operators: LEDGER_NUMBER_OPERATORS,
      },
      {
        name: "cost",
        description: "Posting cost amount.",
        operators: LEDGER_NUMBER_OPERATORS,
      },
      {
        name: "price",
        description: "Posting price amount.",
        operators: LEDGER_NUMBER_OPERATORS,
      },
      {
        name: "date",
        description: "Directive date, including relative dates such as today.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.year",
        description: "Directive year.",
        operators: LEDGER_DATE_OPERATORS,
        values: filterSyntaxValues(values.years),
      },
      {
        name: "date.month",
        description: "Directive month number.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.day",
        description: "Directive day number.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.week",
        description: "Directive week number.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.quarter",
        description: "Directive quarter number.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.weekday",
        description: "Directive weekday number.",
        operators: LEDGER_DATE_OPERATORS,
      },
      {
        name: "date.timestamp",
        description: "Directive date as milliseconds.",
        aliases: ["date.ms", "date.milliseconds", "timestamp"],
        operators: LEDGER_NUMBER_OPERATORS,
      },
    ],
    examples: [
      {
        query: "type: transaction account: Assets:Checking",
        description: "Transactions affecting an account branch.",
      },
      {
        query: "date.year: 2026 amount > 100",
        description: "Large postings in a year.",
      },
      {
        query: 'payee: "Coffee Shop" -tag: reimbursable',
        description: "A payee while excluding a tag.",
      },
    ],
    notes: [
      "Separate terms with a space to require both; use OR, parentheses, or a leading - to change that logic.",
      "Any directive or posting metadata key can also be queried as key: value, but metadata keys depend on this ledger and are not suggested.",
    ],
  };
}

export function isLedgerSearchSort(value: string): value is LedgerSearchSort {
  return LEDGER_SEARCH_SORTS.includes(value as LedgerSearchSort);
}

export function cloneLedgerSearchState(
  state: LedgerSearchState = DEFAULT_LEDGER_SEARCH_STATE,
): LedgerSearchState {
  return {
    ...state,
    types: [...state.types],
    accounts: [...state.accounts],
    payees: [...state.payees],
    tags: [...state.tags],
    years: [...state.years],
  };
}

export function clearLedgerSearchParams(params: URLSearchParams) {
  for (const key of LEDGER_SEARCH_PARAM_KEYS) params.delete(key);
}

export function hasActiveLedgerSearchState(state: LedgerSearchState) {
  return (
    Boolean(state.query.trim()) ||
    state.sort !== DEFAULT_LEDGER_SEARCH_STATE.sort ||
    state.types.length > 0 ||
    state.accounts.length > 0 ||
    state.payees.length > 0 ||
    state.tags.length > 0 ||
    state.years.length > 0
  );
}

function stringParam(
  params: URLSearchParams | Record<string, string | undefined>,
  key: string,
) {
  if (params instanceof URLSearchParams) {
    const value = params.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringParams(
  params: URLSearchParams | Record<string, string | undefined>,
  key: string,
) {
  const raw =
    params instanceof URLSearchParams
      ? params.getAll(key)
      : params[key]?.trim()
        ? [params[key]!.trim()]
        : [];
  // Comma-separated lists and repeated keys both expand.
  return raw.flatMap((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function uniqueValues(values: string[], normalize?: (value: string) => string) {
  const seen = new Set<string>();
  return values
    .map((value) => (normalize ? normalize(value) : value.trim()))
    .filter((value) => {
      if (!value || value === "all") return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function uniqueTags(tags: string[]) {
  return uniqueValues(tags, (tag) => tag.replace(/^#+/, "").trim());
}

/** Quote a filter token when it contains spaces or filter metacharacters. */
export function quoteFilterToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  // Allow unquoted account names (colons) and simple identifiers.
  if (!/[\s"'#^()[\],=<>!~/\\]/.test(trimmed)) return trimmed;
  return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Join facet tokens with OR so multi-select means any match. */
function orGroup(tokens: string[]): string {
  if (!tokens.length) return "";
  if (tokens.length === 1) return tokens[0]!;
  return `(${tokens.join(" OR ")})`;
}

/**
 * Compile facet state into a Beancount filter query string for `parseQuery`.
 * Free-text `query` is passed through (advanced syntax still works there). Sort
 * is client-side only and is not part of the filter query. Within a facet,
 * values are OR'd; facets are AND'd together.
 */
export function facetsToFilterQuery(state: LedgerSearchState): string {
  const parts: string[] = [];
  const freeText = state.query.trim();
  if (freeText) parts.push(freeText);

  const types = uniqueValues(state.types);
  if (types.length) {
    parts.push(orGroup(types.map((type) => `type:${quoteFilterToken(type)}`)));
  }

  const accounts = uniqueValues(state.accounts);
  if (accounts.length) {
    parts.push(
      orGroup(
        accounts.map((account) => `account:${quoteFilterToken(account)}`),
      ),
    );
  }

  const payees = uniqueValues(state.payees);
  if (payees.length) {
    parts.push(
      orGroup(payees.map((payee) => `payee:${quoteFilterToken(payee)}`)),
    );
  }

  const tags = uniqueTags(state.tags);
  if (tags.length) {
    parts.push(orGroup(tags.map((tag) => `#${tag}`)));
  }

  const years = uniqueValues(state.years);
  if (years.length) {
    parts.push(orGroup(years.map((year) => year.trim())));
  }

  return parts.join(" ");
}

export function parseLedgerSearchState(
  input: URL | URLSearchParams | Record<string, string | undefined>,
): LedgerSearchState {
  const params =
    input instanceof URL
      ? input.searchParams
      : input instanceof URLSearchParams
        ? input
        : input;

  const state = cloneLedgerSearchState();
  const searchQ = stringParam(params, "searchQ");
  const legacyQuery = stringParam(params, "query");
  state.query = searchQ ?? legacyQuery ?? "";
  const sort = stringParam(params, "searchSort");
  if (sort && isLedgerSearchSort(sort)) state.sort = sort;

  state.types = uniqueValues(stringParams(params, "searchType"));
  state.accounts = uniqueValues([
    ...stringParams(params, "searchAccounts"),
    ...stringParams(params, "searchAccount"),
  ]);
  state.payees = uniqueValues([
    ...stringParams(params, "searchPayees"),
    ...stringParams(params, "searchPayee"),
  ]);
  state.tags = uniqueTags([
    ...stringParams(params, "searchTags"),
    ...stringParams(params, "searchTag"),
  ]);
  state.years = uniqueValues([
    ...stringParams(params, "searchYears"),
    ...stringParams(params, "searchYear"),
  ]);
  return state;
}

export function appendLedgerSearchParams(
  params: URLSearchParams,
  state: LedgerSearchState,
) {
  clearLedgerSearchParams(params);
  // Prefer search* keys over the legacy filter query param.
  params.delete("query");

  if (state.query.trim()) params.set("searchQ", state.query.trim());
  if (state.sort !== DEFAULT_LEDGER_SEARCH_STATE.sort) {
    params.set("searchSort", state.sort);
  }

  const types = uniqueValues(state.types);
  if (types.length) params.set("searchType", types.join(","));

  const accounts = uniqueValues(state.accounts);
  if (accounts.length) params.set("searchAccounts", accounts.join(","));

  const payees = uniqueValues(state.payees);
  if (payees.length) params.set("searchPayees", payees.join(","));

  const tags = uniqueTags(state.tags);
  if (tags.length) params.set("searchTags", tags.join(","));

  const years = uniqueValues(state.years);
  if (years.length) params.set("searchYears", years.join(","));
}

export function ledgerSearchStateFromQueryRecord(
  query: Record<string, string | undefined>,
): LedgerSearchState {
  return parseLedgerSearchState(query);
}

export function mergeLedgerSearchIntoQuery(
  query: Record<string, string | undefined>,
  state: LedgerSearchState,
): Record<string, string | undefined> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (
      key === "searchTag" ||
      key === "searchTags" ||
      key === "searchAccount" ||
      key === "searchAccounts" ||
      key === "searchPayee" ||
      key === "searchPayees" ||
      key === "searchYear" ||
      key === "searchYears" ||
      key === "searchType"
    ) {
      continue;
    }
    if (value !== undefined && value !== "") params.set(key, value);
  }
  appendLedgerSearchParams(params, state);
  const next: Record<string, string | undefined> = {};
  for (const [key, value] of params.entries()) {
    next[key] = value;
  }
  return next;
}
