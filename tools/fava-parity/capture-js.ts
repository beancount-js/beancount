/**
 * Capture JS-side report payloads using the same LedgerData + runBql
 * paths as the Fava SPA.
 *
 * Run via packages/fava/scripts/run-fava-parity-capture.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Amount,
  Conversion,
  Event,
  Inventory,
  Open,
  Position,
  Query,
  Transaction,
  getConversion,
  type Directive,
} from "@beancount-js/beancount";
import { runBql } from "@beancount-js/beanquery";
import { AccountFilter } from "@beancount-js/filters";
import { formatDate } from "@beancount-js/parser";

import { LedgerSource } from "../../packages/fava/src/core/ledger";
import { Tree } from "../../packages/fava/src/core/tree";
import type { Interval } from "../../packages/fava/src/lib/interval";

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ROOT, "../..");
const CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config.json"), "utf8"));
const OUT = resolve(ROOT, "out/js");

function writeJson(path: string, payload: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function resolveLedgerPath(ledger: {
  path: string;
  root?: string;
}): string {
  if (ledger.root === "repo") {
    return resolve(REPO_ROOT, ledger.path);
  }
  return resolve(ROOT, CONFIG.favaUpstreamPath, ledger.path);
}

function conversionFromFava(value: string): Conversion {
  return getConversion(value.toUpperCase());
}

function serializeTreeNode(
  node: {
    account: string;
    balance: Record<string, number>;
    balanceChildren: Record<string, number>;
    children: Array<unknown>;
    hasTxns?: boolean;
  },
  conversion: Conversion,
) {
  return {
    account: node.account,
    balance: node.balance,
    balance_children: node.balanceChildren,
    children: (node.children as typeof node[]).map((child) =>
      serializeTreeNode(child, conversion),
    ),
    has_txns: Boolean(node.hasTxns),
  };
}

function serializeDirective(directive: Directive) {
  const base: Record<string, unknown> = {
    t: directive.directiveType,
    date: directive.date ? formatDate(directive.date) : null,
    accounts: [...directive.accounts],
  };
  const anyDir = directive as Directive & {
    account?: string;
    payee?: string | null;
    narration?: string;
    flag?: string;
    amount?: { units?: { number?: unknown; currency?: string } };
    currencies?: string[];
  };
  if (anyDir.account) base.account = anyDir.account;
  if (anyDir.payee !== undefined) base.payee = anyDir.payee ?? null;
  if (anyDir.narration !== undefined) base.narration = anyDir.narration;
  if (anyDir.flag !== undefined) base.flag = anyDir.flag;
  if (anyDir.currencies) base.currencies = [...anyDir.currencies];
  if (anyDir.amount?.units) {
    base.amount = {
      number: String(anyDir.amount.units.number ?? ""),
      currency: anyDir.amount.units.currency,
    };
  }
  if (directive instanceof Transaction) {
    base.postings = directive.postings.map((posting) => ({
      account: posting.account,
      units: posting.units
        ? {
            number: String(posting.units.number),
            currency: posting.units.currency,
          }
        : null,
    }));
  }
  return base;
}

function inventoryUnitsMap(inventory: Inventory): Record<string, number> {
  const out: Record<string, number> = {};
  for (const position of inventory.positions) {
    const currency = position.units?.currency;
    if (!currency) continue;
    const number = Number(position.units.number.toString());
    out[currency] = (out[currency] ?? 0) + number;
  }
  return out;
}

function serializeQueryCell(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toISODate?: unknown }).toISODate === "function" &&
    typeof (value as { isValid?: unknown }).isValid === "boolean"
  ) {
    return (value as { toISODate: () => string | null }).toISODate();
  }
  if (value instanceof Inventory) {
    return inventoryUnitsMap(value);
  }
  if (value instanceof Position) {
    return {
      units: value.units
        ? {
            number: Number(value.units.number.toString()),
            currency: value.units.currency,
          }
        : null,
      cost: value.cost
        ? {
            number: value.cost.amount
              ? Number(value.cost.amount.number.toString())
              : null,
            currency: value.cost.amount?.currency ?? null,
            date: value.cost.date ? formatDate(value.cost.date) : null,
          }
        : null,
    };
  }
  if (value instanceof Amount) {
    return {
      number: Number(value.number.toString()),
      currency: value.currency,
    };
  }
  const anyVal = value as {
    toString?: () => string;
    toRecord?: () => Record<string, unknown>;
    units?: { number?: unknown; currency?: string };
    number?: unknown;
    currency?: string;
  };
  if (typeof anyVal.toRecord === "function") {
    const record = anyVal.toRecord();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = typeof v === "number" ? v : Number(String(v));
    }
    return out;
  }
  if (anyVal.units && anyVal.units.currency) {
    return {
      units: {
        number: Number(String(anyVal.units.number ?? "")),
        currency: anyVal.units.currency,
      },
      cost: (value as { cost?: unknown }).cost ?? null,
    };
  }
  if (anyVal.number !== undefined && anyVal.currency) {
    return {
      number: Number(String(anyVal.number)),
      currency: anyVal.currency,
    };
  }
  if (typeof anyVal.toString === "function") {
    const text = anyVal.toString();
    if (text !== "[object Object]") return text;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function roundBudgetMap(
  value: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(value)) {
    out[currency] = Number(Number(amount).toFixed(8));
  }
  return out;
}

function serializeBudgets(
  budgets: Record<
    string,
    Array<{ budget: Record<string, number>; budgetChildren: Record<string, number> }>
  >,
) {
  const out: Record<
    string,
    Array<{ budget: Record<string, number>; budget_children: Record<string, number> }>
  > = {};
  for (const [account, rows] of Object.entries(budgets)) {
    out[account] = rows.map((row) => ({
      budget: roundBudgetMap(row.budget),
      budget_children: roundBudgetMap(row.budgetChildren),
    }));
  }
  return out;
}

function nodeToSerialised(
  tree: Tree,
  account: string,
  conversion: Conversion = Conversion.AT_COST,
) {
  const live = tree.get(account);
  const node = live.toRecord(conversion) as {
    account: string;
    balance: Record<string, number>;
    balanceChildren: Record<string, number>;
    children: Array<unknown>;
  };
  return serializeTreeNode({ ...node, hasTxns: live.hasTxns }, conversion);
}

function captureTreeReports(source: LedgerSource, ledgerOut: string) {
  const opts = source.options.beancount;
  const openTree = source.data.tree.copy();
  const closedTree = source.data.tree
    .copy()
    .cap(opts.account_unrealized_gains, opts);

  const income = nodeToSerialised(openTree, opts.name_income);
  const expenses = nodeToSerialised(openTree, opts.name_expenses);
  const netProfitNode = openTree.netProfit("Net Profit", opts);
  const netProfit = serializeTreeNode(
    {
      ...(netProfitNode.toRecord() as {
        account: string;
        balance: Record<string, number>;
        balanceChildren: Record<string, number>;
        children: Array<unknown>;
      }),
      hasTxns: netProfitNode.hasTxns,
    },
    Conversion.AT_COST,
  );

  writeJson(resolve(ledgerOut, "reports/income_statement.json"), {
    data: {
      trees: [income, netProfit, expenses],
      charts: [],
      date_range: null,
    },
  });

  writeJson(resolve(ledgerOut, "reports/balance_sheet.json"), {
    data: {
      trees: [
        nodeToSerialised(closedTree, opts.name_assets),
        nodeToSerialised(closedTree, opts.name_liabilities),
        nodeToSerialised(closedTree, opts.name_equity),
      ],
      charts: [],
      date_range: null,
    },
  });

  writeJson(resolve(ledgerOut, "reports/trial_balance.json"), {
    data: {
      trees: [nodeToSerialised(openTree, "")],
      charts: [],
      date_range: null,
    },
  });
}

function balanceDirectiveString(
  account: string,
  balance: Record<string, number>,
  today: string,
): string {
  let res = "";
  for (const [currency, number] of Object.entries(balance).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const num = Number(number).toFixed(2);
    res += `${today} balance ${account.padEnd(28)} ${num.padStart(15)} ${currency}\n`;
  }
  return res;
}

function captureStatistics(source: LedgerSource, ledgerOut: string) {
  const entriesByType: Record<string, number> = {};
  for (const directive of source.directives) {
    const type = directive.constructor.name;
    entriesByType[type] = (entriesByType[type] ?? 0) + 1;
  }

  const balances: Record<string, Record<string, number>> = {};
  // Fava includes the empty-root account key.
  balances[""] = {};
  for (const [account, node] of source.data.tree.entries()) {
    balances[account] = node.balance.toRecord(Conversion.UNITS);
  }

  const today = new Date().toISOString().slice(0, 10);
  let allBalanceDirectives = "";
  for (const directive of source.directives) {
    if (!(directive instanceof Open)) continue;
    const meta = directive.meta as Record<string, unknown> | undefined;
    if (!meta?.["fava-uptodate-indication"]) continue;
    // Mirror Fava: only emit when status is not green. Without a full
    // uptodate-status implementation, emit whenever the meta flag is set
    // and the account has a non-empty units balance (approximation).
    const balance = source.data.tree
      .get(directive.account)
      .balance.toRecord(Conversion.UNITS);
    if (Object.keys(balance).length) {
      allBalanceDirectives += balanceDirectiveString(
        directive.account,
        balance,
        today,
      );
    }
  }

  writeJson(resolve(ledgerOut, "reports/statistics.json"), {
    data: {
      all_balance_directives: allBalanceDirectives,
      balances,
      entries_by_type: entriesByType,
    },
  });
}

function captureCommodities(source: LedgerSource, ledgerOut: string) {
  const pairs: Array<{
    base: string;
    quote: string;
    prices: Array<[string, number]>;
  }> = [];
  for (const quote of source.prices.forwardPairs) {
    const points = source.prices.map.get(quote);
    if (!points?.length) continue;
    pairs.push({
      base: quote.base,
      quote: quote.quote,
      prices: points.map(
        (point) =>
          [formatDate(point.date), Number(point.units.toString())] as [
            string,
            number,
          ],
      ),
    });
  }
  pairs.sort((a, b) =>
    `${a.base}:${a.quote}`.localeCompare(`${b.base}:${b.quote}`),
  );
  writeJson(resolve(ledgerOut, "reports/commodities.json"), { data: pairs });
}

function captureEvents(source: LedgerSource, ledgerOut: string) {
  const events = source.directives
    .filter((d): d is Event => d instanceof Event)
    .map((event) => ({
      t: "Event",
      date: formatDate(event.date),
      type: event.type,
      description: event.description,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  writeJson(resolve(ledgerOut, "reports/events.json"), { data: events });
}

function captureOptions(source: LedgerSource, ledgerOut: string) {
  const beancount_options: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.options.beancount)) {
    beancount_options[key] = String(value);
  }
  const fava_options: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.options.fava)) {
    fava_options[key.replaceAll("_", "-")] = String(value);
  }
  writeJson(resolve(ledgerOut, "reports/options.json"), {
    data: { beancount_options, fava_options },
  });
}

function captureErrors(source: LedgerSource, ledgerOut: string) {
  const errors = source.errors.map((error) => ({
    message: error.message,
    type: error.constructor.name,
  }));
  writeJson(resolve(ledgerOut, "reports/errors.json"), { data: errors });
}

function captureLedger(ledger: {
  id: string;
  path: string;
  slug: string;
  root?: string;
}) {
  const ledgerPath = resolveLedgerPath(ledger);
  const contents = readFileSync(ledgerPath, "utf8");
  const source = new LedgerSource(contents, { logTimings: undefined });
  const ledgerOut = resolve(OUT, ledger.id);
  mkdirSync(ledgerOut, { recursive: true });

  writeJson(resolve(ledgerOut, "meta.json"), {
    ledgerId: ledger.id,
    path: ledger.path,
    absolutePath: ledgerPath,
    errorCount: source.errors.length,
    errors: source.errors.slice(0, 20).map((error) => error.message),
    accountCount: source.data.accounts.length,
  });

  writeJson(resolve(ledgerOut, "ledger_data.json"), {
    data: {
      accounts: [...source.data.accounts].sort(),
      years: [...source.data.years].sort(),
      currencies: [...source.data.currencies].sort(),
      errors: source.errors.map((error) => error.message),
    },
  });

  captureTreeReports(source, ledgerOut);
  captureStatistics(source, ledgerOut);
  captureCommodities(source, ledgerOut);
  captureEvents(source, ledgerOut);
  captureOptions(source, ledgerOut);
  captureErrors(source, ledgerOut);

  for (const account of CONFIG.accounts as string[]) {
    for (const interval of CONFIG.intervals as Interval[]) {
      for (const conversionName of CONFIG.conversions as string[]) {
        const conversion = conversionFromFava(conversionName);
        const balanceTrees = source.data.balanceTrees(interval);
        const changeTrees = source.data.changeTrees(interval);

        const toReport = (
          trees: typeof balanceTrees,
          report: "balances" | "changes",
        ) => {
          const accumulate = report === "balances";
          const reversed = [...trees].reverse();
          const budgets = source.data.intervalBudgets(
            account,
            interval,
            accumulate,
          );
          return {
            data: {
              dates: reversed.map((tree) => ({
                begin: formatDate(tree.range.from),
                end: formatDate(tree.range.to),
              })),
              interval_balances: reversed.map((tree) => {
                const context = {
                  prices: source.prices,
                  date: tree.range.endInclusive,
                };
                const node = tree.tree
                  .get(account)
                  .toRecord(conversion, context) as {
                  account: string;
                  balance: Record<string, number>;
                  balanceChildren: Record<string, number>;
                  children: Array<unknown>;
                  hasTxns?: boolean;
                };
                const live = tree.tree.get(account);
                return serializeTreeNode(
                  {
                    ...node,
                    hasTxns: live.hasTxns,
                  },
                  conversion,
                );
              }),
              budgets: serializeBudgets(budgets),
              report,
              account,
              interval,
              conversion: conversionName,
            },
          };
        };

        const balName = `account_report__${account.replace(/:/g, "_")}__balances__${interval}__${conversionName}.json`;
        const chgName = `account_report__${account.replace(/:/g, "_")}__changes__${interval}__${conversionName}.json`;
        writeJson(
          resolve(ledgerOut, "accounts", balName),
          toReport(balanceTrees, "balances"),
        );
        writeJson(
          resolve(ledgerOut, "accounts", chgName),
          toReport(changeTrees, "changes"),
        );
      }
    }

    const journalFiltered = source.data.filter(AccountFilter.of(account));
    const journal = journalFiltered.directives
      .filter((directive) => directive.date)
      .map(serializeDirective);
    writeJson(
      resolve(
        ledgerOut,
        "journals",
        `journal__${account.replace(/:/g, "_")}.json`,
      ),
      { data: journal },
    );
  }

  const queries = [...(CONFIG.queries as Array<{ id: string; query: string }>)];
  for (const directive of source.directives) {
    if (directive instanceof Query) {
      queries.push({
        id: `saved__${directive.name}`,
        query: directive.queryString.toString(),
      });
    }
  }

  for (const item of queries) {
    const result = runBql(source.directives, item.query, {
      options: source.options.beancount,
      errors: source.errors,
    });
    const types = result.columns.map((column) => ({
      name: column.name,
      dtype: String(
        typeof column.type === "string"
          ? column.type
          : ((column.type as { name?: string })?.name ??
              (column.type as { dtype?: string })?.dtype ??
              typeof column.type),
      ),
    }));
    const rows = result.data.map((row) =>
      result.columns.map((column) => serializeQueryCell(row[column.name])),
    );
    writeJson(resolve(ledgerOut, "queries", `${item.id}.json`), {
      data: result.error
        ? { t: "error", error: result.error, types, rows }
        : { t: "table", types, rows },
    });
  }
}

for (const ledger of CONFIG.ledgers as Array<{
  id: string;
  path: string;
  slug: string;
  root?: string;
}>) {
  console.info(`Capturing JS payloads for ${ledger.id}…`);
  captureLedger(ledger);
}

console.info(`Wrote JS captures under ${OUT}`);
