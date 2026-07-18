/**
 * Capture JS-side account/query payloads using the same LedgerData + runBql
 * paths as the Fava SPA.
 *
 * Run via:
 *   node packages/fava/scripts/run-ts.mjs ../../tools/fava-parity/capture-js.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Amount,
  Conversion,
  Inventory,
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
import type { Interval } from "../../packages/fava/src/lib/interval";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config.json"), "utf8"));
const OUT = resolve(ROOT, "out/js");

function writeJson(path: string, payload: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
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
  // TreeNode.toRecord already applied conversion; keep hasTxns if present.
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
  // Luxon DateTime (avoid importing luxon from tools/ for Vite resolution).
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

function captureLedger(ledger: {
  id: string;
  path: string;
  slug: string;
}) {
  const favaRoot = resolve(ROOT, CONFIG.favaUpstreamPath);
  const ledgerPath = resolve(favaRoot, ledger.path);
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

  for (const account of CONFIG.accounts as string[]) {
    for (const interval of CONFIG.intervals as Interval[]) {
      for (const conversionName of CONFIG.conversions as string[]) {
        const conversion = conversionFromFava(conversionName);
        const filtered = source.data.filter(AccountFilter.of(account));

        const balanceTrees = filtered.balanceTrees(interval);
        const changeTrees = filtered.changeTrees(interval);

        const toReport = (
          trees: typeof balanceTrees,
          report: "balances" | "changes",
        ) => {
          // Match Fava: newest interval first.
          const reversed = [...trees].reverse();
          return {
            data: {
              dates: reversed.map((tree) => ({
                begin: formatDate(tree.range.from),
                end: formatDate(tree.range.to),
              })),
              interval_balances: reversed.map((tree) => {
                const node = tree.tree.get(account).toRecord(conversion) as {
                  account: string;
                  balance: Record<string, number>;
                  balanceChildren: Record<string, number>;
                  children: Array<unknown>;
                  hasTxns?: boolean;
                };
                // Attach hasTxns from live tree node.
                const live = tree.tree.get(account);
                return serializeTreeNode(
                  {
                    ...node,
                    hasTxns: live.hasTxns,
                  },
                  conversion,
                );
              }),
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
    writeJson(resolve(ledgerOut, "journals", `journal__${account.replace(/:/g, "_")}.json`), {
      data: journal,
    });
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
          : (column.type as { name?: string })?.name ??
              (column.type as { dtype?: string })?.dtype ??
              typeof column.type,
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
}>) {
  console.info(`Capturing JS payloads for ${ledger.id}…`);
  captureLedger(ledger);
}

console.info(`Wrote JS captures under ${OUT}`);
