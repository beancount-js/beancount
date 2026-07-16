import {
  Amount,
  DIRECTIVE_META,
  LedgerEntry,
  Posting,
  Transaction,
} from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import type { JournalRecord } from "../components/journal-table/model";
import {
  buildDuplicateDeletePatches,
  duplicateFingerprint,
  findDuplicateGroups,
} from "./journal-duplicates";

const date = DateTime.fromISO("2024-01-15");

function attachSource(
  directive: Transaction,
  source: { from: number; to: number; content: string; lineno: number },
) {
  const entry = Object.create(LedgerEntry.prototype) as LedgerEntry;
  Object.assign(entry, {
    position: {
      from: source.from,
      to: source.to,
      line: source.lineno,
    },
    content: source.content,
  });
  directive.meta[DIRECTIVE_META] = entry;
}

function transaction(
  opts: {
    flag?: string;
    payee?: string;
    narration?: string;
    postings?: Posting[];
    meta?: Record<string, unknown>;
    lineno?: number;
    withSource?: { from: number; to: number; content: string };
  } = {},
): Transaction {
  const {
    flag = "*",
    payee = "Cafe",
    narration = "Lunch",
    postings = [
      new Posting("Assets:Cash", new Amount("-12.50", "USD")),
      new Posting("Expenses:Food", new Amount("12.50", "USD")),
    ],
    meta = {},
    lineno = 10,
    withSource,
  } = opts;

  const directive = new Transaction(
    date,
    flag,
    payee,
    narration,
    [],
    [],
    postings,
    {
      filename: "main.beancount",
      lineno,
      ...meta,
    },
  );

  if (withSource) {
    attachSource(directive, { ...withSource, lineno });
  }

  return directive;
}

function record(key: string, directive: Transaction): JournalRecord {
  return {
    key,
    directive,
    date: directive.date,
    dateKey: "2024-01-15",
    title: directive.payee,
    detail: directive.narration,
    type: directive.flag,
  };
}

describe("duplicateFingerprint", () => {
  test("prefers raw_fingerprint meta when present", () => {
    const a = transaction({ meta: { raw_fingerprint: "abc123" } });
    const b = transaction({
      payee: "Other",
      meta: { raw_fingerprint: "abc123" },
    });
    const c = transaction({ meta: { raw_fingerprint: "other" } });
    expect(duplicateFingerprint(a)).toBe("raw:abc123");
    expect(duplicateFingerprint(a)).toBe(duplicateFingerprint(b));
    expect(duplicateFingerprint(a)).not.toBe(duplicateFingerprint(c));
  });

  test("falls back to amount/payee/flag/narration/sorted posting amounts", () => {
    const a = transaction({
      postings: [
        new Posting("Expenses:Food", new Amount("12.50", "USD")),
        new Posting("Assets:Cash", new Amount("-12.50", "USD")),
      ],
    });
    const b = transaction({
      postings: [
        new Posting("Assets:Cash", new Amount("-12.50", "USD")),
        new Posting("Expenses:Food", new Amount("12.50", "USD")),
      ],
    });
    const differentPayee = transaction({ payee: "Diner" });
    expect(duplicateFingerprint(a)).toBe(duplicateFingerprint(b));
    expect(duplicateFingerprint(a)?.startsWith("sem:")).toBe(true);
    expect(duplicateFingerprint(a)).not.toBe(duplicateFingerprint(differentPayee));
  });
});

describe("findDuplicateGroups / buildDuplicateDeletePatches", () => {
  test("keeps earliest lineno and deletes the rest", () => {
    const contentA = "2024-01-15 * \"Cafe\" \"Lunch\"\n";
    const contentB = "2024-01-15 * \"Cafe\" \"Lunch\"\n";
    const first = record(
      "a",
      transaction({
        lineno: 10,
        withSource: { from: 0, to: contentA.length, content: contentA },
      }),
    );
    const second = record(
      "b",
      transaction({
        lineno: 20,
        withSource: {
          from: 100,
          to: 100 + contentB.length,
          content: contentB,
        },
      }),
    );

    const groups = findDuplicateGroups([second, first]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.keep.key).toBe("a");
    expect(groups[0]?.duplicates.map((item) => item.key)).toEqual(["b"]);

    const plan = buildDuplicateDeletePatches([second, first]);
    expect(plan.deleteCount).toBe(1);
    expect(plan.keepCount).toBe(1);
    expect(plan.patches[0]).toMatchObject({
      recordKey: "b",
      next: "",
      original: contentB,
      from: 100,
    });
  });

  test("ignores unique fingerprints and records without source", () => {
    const unique = record("u", transaction({ payee: "Unique" }));
    const dupA = record(
      "a",
      transaction({ meta: { raw_fingerprint: "same" }, lineno: 1 }),
    );
    const dupB = record(
      "b",
      transaction({ meta: { raw_fingerprint: "same" }, lineno: 2 }),
    );

    const plan = buildDuplicateDeletePatches([unique, dupA, dupB]);
    expect(plan.groups).toHaveLength(1);
    expect(plan.patches).toHaveLength(0);
    expect(plan.skipped).toEqual(["b"]);
  });
});
