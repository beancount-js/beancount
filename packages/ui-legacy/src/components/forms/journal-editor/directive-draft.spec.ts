import { describe, expect, it } from "vitest";
import {
  Balance,
  Close,
  Commodity,
  Custom,
  Document,
  Event,
  Note,
  Open,
  Pad,
  Price,
  Query,
  Transaction,
} from "@beancount-js/beancount";
import type { DirectiveBase } from "@beancount-js/beancount";
import { parseDirectives } from "@beancount-js/beancount";
import {
  buildDirectiveSource,
  directiveKind,
  hasEditableAst,
  loadDirectiveDraft,
  tryParseDirectiveDraft,
  type DirectiveKind,
} from "./directive-draft";

const PRELUDE = `option "operating_currency" "USD"
2010-01-01 open Assets:Cash USD
2010-01-01 open Expenses:Food USD
2010-01-01 open Equity:Opening-Balances
`;

function loadKind(kind: DirectiveKind, source: string) {
  const [directives] = parseDirectives(`${PRELUDE}${source}`, {
    filename: "journal-editor.spec.beancount",
    transform: true,
  });
  const directive = directives.find(
    (entry: DirectiveBase) => directiveKind(entry) === kind,
  );
  expect(directive).toBeTruthy();
  expect(hasEditableAst(directive!)).toBe(true);
  return directive!;
}

describe("directive-draft round-trip", () => {
  it.each([
    [
      "transaction",
      '2020-01-01 * "Payee" "Narration"\n  Assets:Cash  10.00 USD\n  Expenses:Food\n',
    ],
    ["open", "2020-01-01 open Assets:Cash USD STRICT\n"],
    ["close", "2020-01-02 close Assets:Cash\n"],
    ["commodity", "2020-01-01 commodity USD\n"],
    ["pad", "2020-01-01 pad Assets:Cash Equity:Opening-Balances\n"],
    ["balance", "2020-01-01 balance Assets:Cash 10.00 USD\n"],
    ["price", "2020-01-01 price HOOL 123.45 USD\n"],
    ["note", '2020-01-01 note Assets:Cash "Called the bank"\n'],
    ["document", '2020-01-01 document Assets:Cash "/tmp/receipt.pdf"\n'],
    ["event", '2020-01-01 event "location" "Berlin"\n'],
    [
      "query",
      '2020-01-01 query "cash" "SELECT account WHERE account ~ \'Cash\'"\n',
    ],
    ["custom", '2020-01-01 custom "budget" "Assets:Cash" 100.00 USD\n'],
  ] as const)("round-trips %s", (kind, source) => {
    const directive = loadKind(kind, source);
    const draft = loadDirectiveDraft(directive);
    const next = buildDirectiveSource(directive, draft);
    const parsed = tryParseDirectiveDraft(next, kind);
    expect(parsed).not.toBeNull();
    expect(directiveKind(parsed!.directive)).toBe(kind);
  });

  it("parses transaction snippets even with booking warnings", () => {
    const parsed = tryParseDirectiveDraft(
      '2020-01-01 * "Payee" "Narration"\n  Assets:Cash  10.00 USD\n  Expenses:Food\n',
      "transaction",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.directive).toBeInstanceOf(Transaction);
  });

  it("keeps domain type constructors", () => {
    expect(
      loadKind(
        "transaction",
        '2020-01-01 * "Payee" "Narration"\n  Assets:Cash  10.00 USD\n  Expenses:Food\n',
      ),
    ).toBeInstanceOf(Transaction);
    expect(loadKind("open", "2020-01-01 open Assets:Cash\n")).toBeInstanceOf(
      Open,
    );
    expect(loadKind("close", "2020-01-02 close Assets:Cash\n")).toBeInstanceOf(
      Close,
    );
    expect(loadKind("commodity", "2020-01-01 commodity USD\n")).toBeInstanceOf(
      Commodity,
    );
    expect(
      loadKind("pad", "2020-01-01 pad Assets:Cash Equity:Opening-Balances\n"),
    ).toBeInstanceOf(Pad);
    expect(
      loadKind("balance", "2020-01-01 balance Assets:Cash 10.00 USD\n"),
    ).toBeInstanceOf(Balance);
    expect(
      loadKind("price", "2020-01-01 price HOOL 123.45 USD\n"),
    ).toBeInstanceOf(Price);
    expect(
      loadKind("note", '2020-01-01 note Assets:Cash "Called the bank"\n'),
    ).toBeInstanceOf(Note);
    expect(
      loadKind(
        "document",
        '2020-01-01 document Assets:Cash "/tmp/receipt.pdf"\n',
      ),
    ).toBeInstanceOf(Document);
    expect(
      loadKind("event", '2020-01-01 event "location" "Berlin"\n'),
    ).toBeInstanceOf(Event);
    expect(
      loadKind(
        "query",
        '2020-01-01 query "cash" "SELECT account WHERE account ~ \'Cash\'"\n',
      ),
    ).toBeInstanceOf(Query);
    expect(
      loadKind(
        "custom",
        '2020-01-01 custom "budget" "Assets:Cash" 100.00 USD\n',
      ),
    ).toBeInstanceOf(Custom);
  });

  it("stores an open account's appearance as directive metadata", () => {
    const [directives] = parseDirectives(
      `${PRELUDE}2020-01-01 open Assets:Appearance USD\n  color: "#f97316"\n  icon: "wallet"\n  merchant_id: "merchant:cash"\n  note: "Everyday spending"\n`,
      {
        filename: "journal-editor.spec.beancount",
        transform: true,
      },
    );
    const directive = directives.find(
      (entry: DirectiveBase) =>
        entry instanceof Open && entry.account === "Assets:Appearance",
    );
    expect(directive).toBeTruthy();
    const parsedDirective = directive;
    if (!parsedDirective) return;
    const draft = loadDirectiveDraft(parsedDirective);

    expect(draft.color).toBe("#F97316");
    expect(draft.icon).toBe("wallet");
    expect(draft.merchantId).toBe("merchant:cash");
    expect(draft.metadata).toEqual([
      { key: "note", value: "Everyday spending" },
    ]);

    draft.color = "#06B6D4";
    draft.icon = "landmark";
    draft.merchantId = "merchant:everyday";
    const next = buildDirectiveSource(parsedDirective, draft);
    const parsed = tryParseDirectiveDraft(next, "open");

    expect(parsed).not.toBeNull();
    expect(parsed!.directive.meta.color).toBe("#06B6D4");
    expect(parsed!.directive.meta.icon).toBe("landmark");
    expect(parsed!.directive.meta.merchant_id).toBe("merchant:everyday");
    expect(parsed!.directive.meta.note).toBe("Everyday spending");
  });
});
