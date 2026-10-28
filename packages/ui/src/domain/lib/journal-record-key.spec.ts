import { DIRECTIVE_META, LedgerEntry, Open } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  findDirectiveByRecordAnchor,
  findDirectiveByRecordKey,
  journalRecordAnchor,
  journalRecordKey,
} from "./journal-record-key";

function directive(account: string, source: { from: number; content: string }) {
  const open = new Open(
    DateTime.fromISO("2024-01-01"),
    account,
    ["GBP"],
    undefined,
    { filename: "accounts.beancount", lineno: 1 },
  );
  const entry = Object.create(LedgerEntry.prototype) as LedgerEntry;
  Object.assign(entry, {
    position: {
      from: source.from,
      to: source.from + source.content.length,
      line: 1,
    },
    content: source.content,
  });
  open.meta[DIRECTIVE_META] = entry;
  return open;
}

describe("journal record anchors", () => {
  test("re-locates an unchanged directive after preceding text moves it", () => {
    const content = "2024-01-01 open Assets:Cash GBP\n";
    const original = directive("Assets:Cash", { from: 10, content });
    const moved = directive("Assets:Cash", { from: 31, content });

    expect(findDirectiveByRecordKey([moved], journalRecordKey(original))).toBe(
      undefined,
    );
    expect(
      findDirectiveByRecordAnchor([moved], journalRecordAnchor(original)),
    ).toBe(moved);
  });

  test("chooses the closest matching duplicate", () => {
    const content = "2024-01-01 open Assets:Cash GBP\n";
    const original = directive("Assets:Cash", { from: 100, content });
    const earlier = directive("Assets:Cash", { from: 20, content });
    const later = directive("Assets:Cash", { from: 115, content });

    expect(
      findDirectiveByRecordAnchor(
        [earlier, later],
        journalRecordAnchor(original),
      ),
    ).toBe(later);
  });
});
