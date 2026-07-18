#!/usr/bin/env node
/**
 * Normalize and diff Fava vs JS captures, then write REPORT.md.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf8"));
const FAVA_OUT = join(ROOT, "out/fava");
const JS_OUT = join(ROOT, "out/js");
const TOLERANCE = CONFIG.numberTolerance ?? 1e-4;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function roundNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (Math.abs(value) < TOLERANCE) return 0;
  return Math.round(value / TOLERANCE) * TOLERANCE;
}

function normalizeInventory(inv) {
  if (!inv || typeof inv !== "object" || Array.isArray(inv)) return inv;
  const out = {};
  for (const [currency, amount] of Object.entries(inv)) {
    const n = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(n) || Math.abs(n) < TOLERANCE) continue;
    out[currency] = roundNumber(n);
  }
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function normalizeTreeNode(node) {
  if (!node || typeof node !== "object") return node;
  return {
    account: node.account,
    balance: normalizeInventory(node.balance ?? {}),
    balance_children: normalizeInventory(
      node.balance_children ?? node.balanceChildren ?? {},
    ),
    children: [...(node.children ?? [])]
      .map(normalizeTreeNode)
      .sort((a, b) => a.account.localeCompare(b.account)),
  };
}

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

function normalizeAccountReport(payload) {
  const data = unwrap(payload);
  if (!data || data.error) {
    return { error: data?.error ?? "missing", body: data?.body };
  }
  const dates = [...(data.dates ?? [])];
  const trees = [...(data.interval_balances ?? [])].map(normalizeTreeNode);
  const byBegin = new Map();
  for (let i = 0; i < dates.length; i += 1) {
    const begin = dates[i]?.begin;
    if (!begin) continue;
    // Fava uses half-open [begin, end); JS often uses inclusive end-of-period.
    // Compare trees keyed by begin only.
    byBegin.set(begin, trees[i]);
  }
  const begins = [...byBegin.keys()].sort();
  return {
    interval_begins: begins,
    interval_balances: Object.fromEntries(
      begins.map((begin) => [begin, byBegin.get(begin)]),
    ),
  };
}

function normalizeJournalEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const t = String(entry.t ?? entry.directiveType ?? "").toLowerCase();
  const date = entry.date ? String(entry.date).slice(0, 10) : null;
  const account = entry.account ?? null;
  const payee = entry.payee ?? "";
  const narration = entry.narration ?? "";
  const postingAccounts = Array.isArray(entry.postings)
    ? entry.postings.map((p) => p.account).sort()
    : [];
  return { t, date, account, payee, narration, postingAccounts };
}

function normalizeJournal(payload) {
  const data = unwrap(payload);
  if (!Array.isArray(data)) {
    return { error: "not-array", sample: data };
  }
  // Compare transaction/balance/open/close activity fingerprints only.
  const allowed = new Set([
    "transaction",
    "balance",
    "open",
    "close",
    "pad",
    "note",
    "document",
  ]);
  return data
    .map(normalizeJournalEntry)
    .filter((entry) => entry.date && allowed.has(entry.t))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function normalizeQueryCell(cell) {
  if (cell == null) return null;
  if (typeof cell === "number") return roundNumber(cell);
  if (typeof cell === "boolean") return cell;
  if (typeof cell === "string") {
    // DateTime ISO → date
    if (/^\d{4}-\d{2}-\d{2}T/.test(cell)) return cell.slice(0, 10);
    // Decimal serialized as string
    if (/^-?\d+(\.\d+)?$/.test(cell)) return roundNumber(Number(cell));
    return cell;
  }
  if (Array.isArray(cell)) return cell.map(normalizeQueryCell);
  if (typeof cell === "object") {
    if ("units" in cell) {
      return {
        units: {
          number: roundNumber(Number(cell.units?.number)),
          currency: cell.units?.currency,
        },
        cost:
          cell.cost == null
            ? null
            : {
                number:
                  cell.cost.number == null
                    ? null
                    : roundNumber(Number(cell.cost.number)),
                currency: cell.cost.currency ?? null,
                date: cell.cost.date
                  ? String(cell.cost.date).slice(0, 10)
                  : null,
              },
      };
    }
    if ("number" in cell && "currency" in cell && !("units" in cell)) {
      return {
        number: roundNumber(Number(cell.number)),
        currency: cell.currency,
      };
    }
    const keys = Object.keys(cell);
    if (
      keys.length > 0 &&
      keys.every(
        (k) => typeof cell[k] === "number" || typeof cell[k] === "string",
      )
    ) {
      return normalizeInventory(cell);
    }
    const out = {};
    for (const [k, v] of Object.entries(cell)) {
      out[k] = normalizeQueryCell(v);
    }
    return out;
  }
  return String(cell);
}

function normalizeDtype(dtype) {
  const raw = String(dtype ?? "").toLowerCase();
  if (!raw || raw === "undefined" || raw === "object") return "object";
  if (raw.includes("inventory")) return "inventory";
  if (raw.includes("position")) return "position";
  if (raw.includes("amount")) return "amount";
  if (raw.includes("decimal") || raw === "number") return "decimal";
  // Beanquery often labels account columns as "account"; Fava uses "str".
  if (raw === "account" || raw.includes("str") || raw === "string") return "str";
  if (raw.includes("date")) return "date";
  if (raw.includes("bool")) return "bool";
  if (raw.includes("int")) return "int";
  if (raw.includes("set")) return "set";
  return raw;
}

function normalizeQuery(payload) {
  const data = unwrap(payload);
  if (!data) return { error: "missing" };
  if (data.error && data.t === "error") {
    return { t: "error", error: String(data.error) };
  }
  if (data.t === "string") {
    return { t: "string", contents: String(data.contents ?? "") };
  }
  if (data.error && !data.rows) {
    return { t: "error", error: String(data.error) };
  }
  const types = (data.types ?? []).map((col, index) => ({
    name: String(col.name ?? `col${index}`).toLowerCase(),
    dtype: normalizeDtype(col.dtype ?? col.type),
  }));
  const rows = (data.rows ?? []).map((row) =>
    row.map((cell) => normalizeQueryCell(cell)),
  );
  // Sort aggregate-looking queries by serialized row for stable compare.
  const sortedRows = [...rows].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
  return { t: "table", types, rows: sortedRows };
}

function normalizeAccountsList(payload) {
  const data = unwrap(payload);
  const accounts = [...(data?.accounts ?? [])]
    .map(String)
    .filter((account) => account.length > 0)
    .sort();
  // Compare as sets; also report parent-only extras separately via length.
  return {
    accounts,
    accountSet: accounts,
  };
}

function deepEqual(a, b, path = "", diffs = [], budget = { left: 40 }) {
  if (budget.left <= 0) return diffs;
  if (a === b) return diffs;
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) <= TOLERANCE) return diffs;
    diffs.push({ path, expected: a, actual: b });
    budget.left -= 1;
    return diffs;
  }
  if (a == null || b == null || typeof a !== typeof b) {
    diffs.push({ path, expected: a, actual: b });
    budget.left -= 1;
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push({
        path: `${path}.length`,
        expected: a.length,
        actual: b.length,
      });
      budget.left -= 1;
    }
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n && budget.left > 0; i += 1) {
      deepEqual(a[i], b[i], `${path}[${i}]`, diffs, budget);
    }
    return diffs;
  }
  if (typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...keys].sort()) {
      if (budget.left <= 0) break;
      deepEqual(a[key], b[key], path ? `${path}.${key}` : key, diffs, budget);
    }
    return diffs;
  }
  diffs.push({ path, expected: a, actual: b });
  budget.left -= 1;
  return diffs;
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function classify(relPath) {
  const normalized = relPath.replaceAll("\\", "/");
  if (
    normalized.includes("/accounts/") ||
    normalized.startsWith("accounts/")
  ) {
    return "account_report";
  }
  if (
    normalized.includes("/journals/") ||
    normalized.startsWith("journals/")
  ) {
    return "journal";
  }
  if (normalized.includes("/queries/") || normalized.startsWith("queries/")) {
    return "query";
  }
  if (basename(normalized) === "ledger_data.json") return "ledger_data";
  return "other";
}

function normalizeByKind(kind, payload) {
  switch (kind) {
    case "account_report":
      return normalizeAccountReport(payload);
    case "journal":
      return normalizeJournal(payload);
    case "query":
      return normalizeQuery(payload);
    case "ledger_data":
      return normalizeAccountsList(payload);
    default:
      return payload;
  }
}

function summarizeDiffs(diffs) {
  const paths = diffs.map((d) => d.path);
  const inventory = paths.filter((p) =>
    /balance|inventory|units|number/i.test(p),
  ).length;
  const dates = paths.filter((p) => /date/i.test(p)).length;
  const lengths = paths.filter((p) => p.endsWith(".length")).length;
  return { inventory, dates, lengths, total: diffs.length };
}

function likelyLayer(kind, relPath, diffs) {
  if (kind === "query") {
    if (diffs.some((d) => String(d.expected?.error || d.actual?.error || "").length)) {
      return "@beancount-js/beanquery (parse/execute error)";
    }
    return "@beancount-js/beanquery (result shape / aggregation)";
  }
  if (kind === "journal") {
    return "@beancount-js/beancount (loader/filter) or journal serialization";
  }
  if (kind === "account_report") {
    if (diffs.some((d) => /date/i.test(d.path))) {
      return "packages/fava LedgerData interval bucketing";
    }
    if (relPath.includes("at_value")) {
      return "@beancount-js/beancount price/conversion (AT_VALUE)";
    }
    return "packages/fava Tree/LedgerData aggregation or @beancount-js/beancount booking";
  }
  if (kind === "ledger_data") {
    return "@beancount-js/beancount account discovery / open directives";
  }
  return "unknown";
}

function fixSuggestion(kind, layer, summary) {
  if (kind === "query") {
    return "Add a beanquery fixture for this BQL against the shared ledger; align column dtypes and Inventory/Position cell encoding with Fava’s query JSON serializer.";
  }
  if (kind === "account_report" && summary.dates) {
    return "Compare LedgerData.dateRanges / intervalEnds with Fava’s interval generation (inclusive end, first/last txn bounds) and adjust range edges before re-testing trees.";
  }
  if (kind === "account_report" && layer.includes("AT_VALUE")) {
    return "Audit PriceMap / cost_or_value conversion against Beancount get_value for the same as-of dates used by Fava’s account_report.";
  }
  if (kind === "account_report") {
    return "Diff a single interval tree node for the failing account; if leaf units match but parents differ, fix Tree.insertBalance rollup; if leaves differ, fix booking/cost reduction first.";
  }
  if (kind === "journal") {
    return "Compare filtered directive sets (AccountFilter vs Fava account filter). Ignore entry_hash/filename; focus on missing/extra txn dates and posting amounts.";
  }
  if (kind === "ledger_data") {
    return "Reconcile account sets from open directives and implied accounts; Fava may include accounts only seen on postings.";
  }
  return "Inspect normalized JSON under tools/fava-parity/out/normalized/ for this case.";
}

function comparePair(favaPath, jsPath, kind) {
  const favaRaw = readJson(favaPath);
  const jsRaw = readJson(jsPath);
  const expected = normalizeByKind(kind, favaRaw);
  const actual = normalizeByKind(kind, jsRaw);
  let diffs = deepEqual(expected, actual);

  // For account reports, also score shared-interval tree parity separately so
  // half-open end encoding / extra trailing intervals don't bury balance bugs.
  let sharedTreePass = null;
  if (
    kind === "account_report" &&
    expected?.interval_balances &&
    actual?.interval_balances
  ) {
    const shared = expected.interval_begins.filter((b) =>
      actual.interval_begins.includes(b),
    );
    const sharedExpected = {
      interval_balances: Object.fromEntries(
        shared.map((b) => [b, expected.interval_balances[b]]),
      ),
    };
    const sharedActual = {
      interval_balances: Object.fromEntries(
        shared.map((b) => [b, actual.interval_balances[b]]),
      ),
    };
    const sharedDiffs = deepEqual(sharedExpected, sharedActual);
    sharedTreePass = sharedDiffs.length === 0;
    if (sharedTreePass && diffs.length > 0) {
      // Downgrade pure interval-set mismatches when shared trees match.
      diffs = diffs.filter(
        (d) =>
          d.path.startsWith("interval_begins") ||
          d.path.includes("interval_begins"),
      );
      if (diffs.length === 0) {
        // Keep a soft note via a synthetic diff only if begins differ.
        const beginDiff = deepEqual(
          expected.interval_begins,
          actual.interval_begins,
        );
        diffs = beginDiff;
      }
    }
  }

  return { expected, actual, diffs, sharedTreePass };
}

function main() {
  const findings = [];
  const summary = {
    account_report: { pass: 0, fail: 0 },
    journal: { pass: 0, fail: 0 },
    query: { pass: 0, fail: 0 },
    ledger_data: { pass: 0, fail: 0 },
    other: { pass: 0, fail: 0 },
  };

  const normOut = join(ROOT, "out/normalized");
  mkdirSync(normOut, { recursive: true });

  for (const ledger of CONFIG.ledgers) {
    const favaDir = join(FAVA_OUT, ledger.id);
    const jsDir = join(JS_OUT, ledger.id);
    if (!existsSync(favaDir) || !existsSync(jsDir)) {
      findings.push({
        id: `${ledger.id}/missing-captures`,
        kind: "other",
        pass: false,
        note: `Missing captures under ${favaDir} or ${jsDir}`,
        diffs: [],
      });
      continue;
    }

    const favaFiles = listFiles(favaDir).filter(
      (p) => basename(p) !== "meta.json",
    );
    for (const favaPath of favaFiles) {
      const rel = relative(favaDir, favaPath);
      const jsPath = join(jsDir, rel);
      const kind = classify(rel);
      if (!existsSync(jsPath)) {
        summary[kind].fail += 1;
        findings.push({
          id: `${ledger.id}/${rel}`,
          kind,
          pass: false,
          note: "JS capture missing for this Fava artifact",
          diffs: [{ path: "", expected: "present", actual: "missing" }],
          layer: "harness",
          suggestion: "Ensure capture-js.ts emits the same relative filenames as capture-fava.py.",
        });
        continue;
      }

      const { expected, actual, diffs, sharedTreePass } = comparePair(
        favaPath,
        jsPath,
        kind,
      );
      const caseId = `${ledger.id}/${rel}`;
      const normDir = join(normOut, ledger.id, dirname(rel));
      mkdirSync(normDir, { recursive: true });
      const stem = basename(rel, ".json");
      writeFileSync(
        join(normDir, `${stem}.expected.json`),
        `${JSON.stringify(expected, null, 2)}\n`,
      );
      writeFileSync(
        join(normDir, `${stem}.actual.json`),
        `${JSON.stringify(actual, null, 2)}\n`,
      );

      if (diffs.length === 0) {
        summary[kind].pass += 1;
        findings.push({
          id: caseId,
          kind,
          pass: true,
          diffs: [],
          sharedTreePass,
        });
      } else {
        summary[kind].fail += 1;
        const stats = summarizeDiffs(diffs);
        const layer = likelyLayer(kind, rel, diffs);
        findings.push({
          id: caseId,
          kind,
          pass: false,
          diffs: diffs.slice(0, 12),
          stats,
          layer,
          sharedTreePass,
          suggestion: fixSuggestion(kind, layer, stats),
        });
      }
    }
  }

  writeFileSync(
    join(ROOT, "out/summary.json"),
    `${JSON.stringify({ summary, findings }, null, 2)}\n`,
  );

  const report = renderReport(summary, findings);
  writeFileSync(join(ROOT, "REPORT.md"), report);
  console.info(`Wrote ${join(ROOT, "REPORT.md")}`);
  console.info(JSON.stringify(summary, null, 2));
}

function renderReport(summary, findings) {
  const failed = findings.filter((f) => !f.pass);
  const passed = findings.filter((f) => f.pass);
  const accountFails = failed.filter((f) => f.kind === "account_report");
  const intervalOnly = accountFails.filter((f) => f.sharedTreePass === true);
  const treeFails = accountFails.filter((f) => f.sharedTreePass === false);
  const valueTreeFails = treeFails.filter((f) => f.id.includes("at_value"));
  const costTreeFails = treeFails.filter((f) => f.id.includes("at_cost"));
  const lines = [];
  lines.push("# Fava Accounts/Queries Output Parity Report");
  lines.push("");
  lines.push("## Setup");
  lines.push("");
  lines.push(`- Upstream Fava commit: \`${CONFIG.favaCommit}\``);
  lines.push(`- Fava CLI hint: ${CONFIG.favaVersionHint}`);
  lines.push(
    `- Shared ledgers: ${CONFIG.ledgers.map((l) => `\`${l.path}\``).join(", ")}`,
  );
  lines.push(
    `- Accounts: ${CONFIG.accounts.map((a) => `\`${a}\``).join(", ")}`,
  );
  lines.push(
    `- Intervals: ${CONFIG.intervals.join(", ")}; conversions: ${CONFIG.conversions.join(", ")}`,
  );
  lines.push(
    `- Number tolerance: ${TOLERANCE} (inventories rounded; near-zero dropped)`,
  );
  lines.push(
    "- Comparison method: upstream Fava JSON API (`account_report`, `journal`, `query`, `ledger_data`) vs JS `LedgerData` / `runBql` (same computation path as the SPA).",
  );
  lines.push(
    "- Account trees are compared by interval **begin** date after normalizing inventories; half-open vs inclusive end encoding is treated as an interval-set issue when shared-begin trees match.",
  );
  lines.push(
    "- Visual/HTML journal markup, charts, and UI chrome are out of scope.",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Category | Pass | Fail |");
  lines.push("|---|---:|---:|");
  for (const kind of ["account_report", "journal", "query", "ledger_data"]) {
    lines.push(
      `| ${kind} | ${summary[kind].pass} | ${summary[kind].fail} |`,
    );
  }
  lines.push(
    `| **total** | **${passed.length}** | **${failed.length}** |`,
  );
  lines.push("");
  lines.push("### Account-report breakdown");
  lines.push("");
  lines.push(
    `| Subcategory | Count | Meaning |`,
  );
  lines.push("|---|---:|---|");
  lines.push(
    `| Shared-interval trees match (interval-set only) | ${intervalOnly.length} | Balances/changes agree for overlapping begins; JS interval bounds/count differ |`,
  );
  lines.push(
    `| Shared-interval tree value mismatch (at_cost) | ${costTreeFails.length} | Real rollup/booking divergence on overlapping intervals |`,
  );
  lines.push(
    `| Shared-interval tree value mismatch (at_value) | ${valueTreeFails.length} | Likely price/conversion divergence |`,
  );
  lines.push(
    `| Exact pass (interval set + trees) | ${summary.account_report.pass} | Full match after normalization |`,
  );
  lines.push("");

  lines.push("## Key findings");
  lines.push("");
  lines.push(
    "1. **AT_COST account trees largely match Fava on shared interval begins.** Most account_report “failures” are interval boundary/count differences (JS often emits an extra trailing period and uses inclusive period ends; Fava uses half-open `[begin, end)`).",
  );
  lines.push(
    "2. **AT_VALUE trees diverge on priced commodities** (e.g. `Assets:US:ETrade:GLD`, `Assets:US:Vanguard:RGAGX`). Example year snapshot for GLD 2015-01-01: Fava `USD 2029.60` vs JS `USD 2090`.",
  );
  lines.push(
    "3. **Beanquery `balances` shell command fails** (`Invalid query stack(0)`), while Fava returns a full balances table. Saved `balances` queries on `query-example` hit the same bug.",
  );
  lines.push(
    "4. **SELECT-style queries are much closer** after Inventory/date normalization; remaining issues include holdings-style GROUP BY row counts and some Decimal/type labeling differences.",
  );
  lines.push(
    "5. **Account lists differ**: JS includes intermediate parent accounts (e.g. `Assets`, `Assets:US`) that Fava’s `ledger_data.accounts` omits; JS also reports a larger set overall.",
  );
  lines.push(
    "6. **Account-filtered journals** still disagree on entry membership/fingerprint after reducing to open/close/txn/balance/pad/note/document — filter semantics or directive coverage differ.",
  );
  lines.push("");

  lines.push("## Disparities");
  lines.push("");
  if (failed.length === 0) {
    lines.push("No disparities found under the current matrix.");
  } else {
    // Prioritize high-signal groups first.
    const sections = [
      {
        title: "account_report — shared tree value mismatches",
        items: treeFails,
      },
      {
        title: "account_report — interval-set only (shared trees match)",
        items: intervalOnly,
        sampleOnly: true,
      },
      {
        title: "query",
        items: failed.filter((f) => f.kind === "query"),
      },
      {
        title: "journal",
        items: failed.filter((f) => f.kind === "journal"),
        sampleOnly: true,
      },
      {
        title: "ledger_data",
        items: failed.filter((f) => f.kind === "ledger_data"),
      },
    ];
    for (const section of sections) {
      if (!section.items.length) continue;
      lines.push(`### ${section.title} (${section.items.length})`);
      lines.push("");
      const show = section.sampleOnly
        ? section.items.slice(0, 8)
        : section.items.slice(0, 40);
      for (const finding of show) {
        lines.push(`#### \`${finding.id}\``);
        lines.push("");
        if (finding.note) lines.push(`${finding.note}`);
        if (finding.sharedTreePass === true) {
          lines.push(
            "- Shared-interval trees: **match** (failure is interval begin set / bounds)",
          );
        } else if (finding.sharedTreePass === false) {
          lines.push("- Shared-interval trees: **mismatch**");
        }
        if (finding.layer) lines.push(`- Likely layer: ${finding.layer}`);
        if (finding.suggestion) {
          lines.push(`- Suggestion: ${finding.suggestion}`);
        }
        if (finding.stats) {
          lines.push(
            `- Diff stats: ${finding.stats.total} paths (inventory-ish ${finding.stats.inventory}, date-ish ${finding.stats.dates}, length ${finding.stats.lengths})`,
          );
        }
        if (finding.diffs?.length) {
          lines.push("");
          lines.push("Sample diffs:");
          lines.push("");
          lines.push("```json");
          lines.push(JSON.stringify(finding.diffs.slice(0, 6), null, 2));
          lines.push("```");
        }
        lines.push("");
      }
      if (section.items.length > show.length) {
        lines.push(
          `_…and ${section.items.length - show.length} more; see \`out/summary.json\`._`,
        );
        lines.push("");
      }
    }
  }

  lines.push("## Passing cases");
  lines.push("");
  lines.push(`Total passing: ${passed.length}.`);
  lines.push("");
  if (passed.length && passed.length <= 80) {
    for (const finding of passed) {
      lines.push(`- \`${finding.id}\``);
    }
  } else if (passed.length) {
    lines.push(
      "Passing case IDs are listed in `tools/fava-parity/out/summary.json`.",
    );
  }
  lines.push("");

  lines.push("## Known non-goals");
  lines.push("");
  lines.push("- HTML account journals from `account_report` (journal mode)");
  lines.push("- Chart aesthetics / ChartSwitcher ordering");
  lines.push("- URL routing, sidebar, and filter UI chrome");
  lines.push("- Balance sheet / income statement / holdings pages (unless pointed to by a query failure)");
  lines.push("- Exact dtype label strings when normalized types already match");
  lines.push("");

  lines.push("## Recommended follow-ups");
  lines.push("");
  const ranked = prioritize(failed);
  if (!ranked.length) {
    lines.push("1. Promote this harness into CI with a small smoke subset once green.");
  } else {
    ranked.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  lines.push("");
  lines.push("## How to regenerate");
  lines.push("");
  lines.push("```bash");
  lines.push("cd tools/fava-parity");
  lines.push("./run.sh");
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function prioritize(failed) {
  const tips = [];
  const intervalOnly = failed.some(
    (f) => f.kind === "account_report" && f.sharedTreePass === true,
  );
  const valueTree = failed.some(
    (f) =>
      f.kind === "account_report" &&
      f.sharedTreePass === false &&
      f.id.includes("at_value"),
  );
  const costTree = failed.some(
    (f) =>
      f.kind === "account_report" &&
      f.sharedTreePass === false &&
      f.id.includes("at_cost"),
  );
  const balancesCmd = failed.some((f) => f.id.includes("/queries/balances"));
  const hasJournal = failed.some((f) => f.kind === "journal");
  const hasAccounts = failed.some((f) => f.kind === "ledger_data");

  if (costTree) {
    tips.push(
      "Investigate remaining AT_COST shared-interval tree mismatches first (unexpected if most leaves already match).",
    );
  }
  if (valueTree) {
    tips.push(
      "Audit AT_VALUE / price conversion for GLD and Vanguard funds against Fava’s account_report as-of dates.",
    );
  }
  if (intervalOnly) {
    tips.push(
      "Align `LedgerData.dateRanges` / `intervalEnds` with Fava’s half-open intervals and first/last bounds so trailing extra periods disappear.",
    );
  }
  if (balancesCmd) {
    tips.push(
      "Implement or fix Beanquery `balances` shell command parity (`Invalid query stack(0)`).",
    );
  }
  tips.push(
    "Add beanquery fixtures for holdings-style GROUP BY and `SELECT account, sum(number), currency` against the shared example ledger.",
  );
  if (hasJournal) {
    tips.push(
      "Reconcile account-filtered journal membership (Open/Txn coverage) against Fava `/api/journal?account=`.",
    );
  }
  if (hasAccounts) {
    tips.push(
      "Decide whether intermediate parent accounts belong in the accounts list; match Fava’s leaf/open-oriented set for UI parity.",
    );
  }
  tips.push(
    "Regenerate with `tools/fava-parity/./run.sh` after each fix; use year/at_cost leaf accounts as the fast inner loop.",
  );
  return tips;
}

main();
