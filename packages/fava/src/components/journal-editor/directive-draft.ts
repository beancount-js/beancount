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
  type DirectiveBase,
} from "@beancount-js/beancount";
import {
  Amount as ParserAmount,
  Attribute,
  Attributes,
  BalanceDirective,
  CloseDirective,
  CommodityDirective,
  CustomDirective,
  DocumentDirective,
  EventDirective,
  Link,
  NoteDirective,
  OpenDirective,
  PadDirective,
  Position,
  Posting as ParserPosting,
  PriceDirective,
  QueryDirective,
  Tag,
  TransactionDirective,
  formatDate,
  parseNumber,
  type BookingMethod,
  type DatedDirective,
} from "@beancount-js/parser";
import { DateTime } from "luxon";
import { LedgerSource } from "../../core/ledger";

export type PostingDraft = {
  account: string;
  amount: string;
  currency: string;
};

export type MetadataRow = { key: string; value: string };

export type DirectiveKind =
  | "transaction"
  | "open"
  | "close"
  | "commodity"
  | "pad"
  | "balance"
  | "price"
  | "note"
  | "document"
  | "event"
  | "query"
  | "custom"
  | "unknown";

export type DirectiveDraft = {
  kind: DirectiveKind;
  date: string;
  // transaction
  flag: string;
  payee: string;
  narration: string;
  tags: string[];
  links: string[];
  postings: PostingDraft[];
  // shared account fields
  account: string;
  account2: string;
  // amounts
  amount: string;
  currency: string;
  currency2: string;
  tolerance: string;
  // open
  currencies: string[];
  booking: BookingMethod | "";
  color: string;
  icon: string;
  merchantId: string;
  // text bodies
  comment: string;
  path: string;
  eventType: string;
  description: string;
  name: string;
  query: string;
  customType: string;
  customValues: string[];
  metadata: MetadataRow[];
};

const BOOKING_OPTIONS: BookingMethod[] = [
  "DEFAULT",
  "STRICT",
  "NONE",
  "AVERAGE",
  "FIFO",
  "LIFO",
  "HIFO",
];

export const bookingOptions = BOOKING_OPTIONS.map((value) => ({
  value,
  label: value === "DEFAULT" ? "Default" : value,
}));

export function emptyDraft(kind: DirectiveKind = "unknown"): DirectiveDraft {
  return {
    kind,
    date: "",
    flag: "*",
    payee: "",
    narration: "",
    tags: [],
    links: [],
    postings: [
      { account: "", amount: "", currency: "" },
      { account: "", amount: "", currency: "" },
    ],
    account: "",
    account2: "",
    amount: "",
    currency: "",
    currency2: "",
    tolerance: "",
    currencies: [],
    booking: "",
    color: "",
    icon: "",
    merchantId: "",
    comment: "",
    path: "",
    eventType: "",
    description: "",
    name: "",
    query: "",
    customType: "",
    customValues: [],
    metadata: [],
  };
}

export function directiveKind(value: DirectiveBase): DirectiveKind {
  if (value instanceof Transaction) return "transaction";
  if (value instanceof Open) return "open";
  if (value instanceof Close) return "close";
  if (value instanceof Commodity) return "commodity";
  if (value instanceof Pad) return "pad";
  if (value instanceof Balance) return "balance";
  if (value instanceof Price) return "price";
  if (value instanceof Note) return "note";
  if (value instanceof Document) return "document";
  if (value instanceof Event) return "event";
  if (value instanceof Query) return "query";
  if (value instanceof Custom) return "custom";
  return "unknown";
}

export function sheetTitleForKind(kind: DirectiveKind) {
  switch (kind) {
    case "transaction":
      return "Edit Transaction";
    case "open":
      return "Edit Open";
    case "close":
      return "Edit Close";
    case "commodity":
      return "Edit Commodity";
    case "pad":
      return "Edit Pad";
    case "balance":
      return "Edit Balance";
    case "price":
      return "Edit Price";
    case "note":
      return "Edit Note";
    case "document":
      return "Edit Document";
    case "event":
      return "Edit Event";
    case "query":
      return "Edit Query";
    case "custom":
      return "Edit Custom";
    default:
      return "Edit Record";
  }
}

export function hasEditableAst(value: DirectiveBase) {
  const source = value.source?.directive;
  if (!source) return false;
  if (value instanceof Transaction)
    return source instanceof TransactionDirective;
  if (value instanceof Open) return source instanceof OpenDirective;
  if (value instanceof Close) return source instanceof CloseDirective;
  if (value instanceof Commodity) return source instanceof CommodityDirective;
  if (value instanceof Pad) return source instanceof PadDirective;
  if (value instanceof Balance) return source instanceof BalanceDirective;
  if (value instanceof Price) return source instanceof PriceDirective;
  if (value instanceof Note) return source instanceof NoteDirective;
  if (value instanceof Document) return source instanceof DocumentDirective;
  if (value instanceof Event) return source instanceof EventDirective;
  if (value instanceof Query) return source instanceof QueryDirective;
  if (value instanceof Custom) return source instanceof CustomDirective;
  return false;
}

const OPEN_ACCOUNT_METADATA_KEYS = new Set(["color", "icon", "merchant_id"]);

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function publicMetadata(
  meta: Record<string, unknown>,
  omittedKeys: ReadonlySet<string> = new Set(),
): MetadataRow[] {
  return Object.entries(meta)
    .filter(
      ([key]) =>
        !key.startsWith("__") &&
        key !== "filename" &&
        key !== "lineno" &&
        !omittedKeys.has(key),
    )
    .map(([key, value]) => ({
      key,
      value: value == null ? "" : String(value),
    }));
}

export function normalizeTags(values: readonly string[]) {
  return [
    ...new Set(
      values.map((item) => item.trim().replace(/^#/, "")).filter(Boolean),
    ),
  ];
}

export function normalizeLinks(values: readonly string[]) {
  return [
    ...new Set(
      values.map((item) => item.trim().replace(/^\^/, "")).filter(Boolean),
    ),
  ];
}

function parseDate(value: string) {
  const date = DateTime.fromISO(value, { zone: "utc" });
  if (!date.isValid) throw new Error("Enter a valid ISO date.");
  return date.startOf("day");
}

function requireAccount(value: string, label = "Account") {
  const account = value.trim();
  if (!account) throw new Error(`${label} is required.`);
  return account;
}

function parseAmountPair(amount: string, currency: string, label: string) {
  const amountText = amount.trim();
  const currencyText = currency.trim();
  if (!amountText || !currencyText) {
    throw new Error(`${label} needs both an amount and a currency.`);
  }
  const value = parseNumber(amountText);
  if (!value) throw new Error(`${label} has an invalid amount.`);
  return new ParserAmount(value, currencyText);
}

function tagsFromDraft(values: readonly string[]) {
  return normalizeTags(values).map(
    (value) => new Tag(new Position(0, 0, 0), value),
  );
}

function linksFromDraft(values: readonly string[]) {
  return normalizeLinks(values).map(
    (value) => new Link(new Position(0, 0, 0), value),
  );
}

export function loadDirectiveDraft(value: DirectiveBase): DirectiveDraft {
  const kind = directiveKind(value);
  const draft = emptyDraft(kind);
  draft.date = value.date ? formatDate(value.date) : "";
  const metadata = value.meta as Record<string, unknown>;
  draft.metadata = publicMetadata(
    metadata,
    value instanceof Open ? OPEN_ACCOUNT_METADATA_KEYS : undefined,
  );

  if (value instanceof Transaction) {
    draft.flag = value.flag || "*";
    draft.payee = value.payee || "";
    draft.narration = value.narration || "";
    draft.tags = [...value.tags];
    draft.links = [...value.links];
    draft.postings = value.postings.map((posting) => ({
      account: posting.account,
      amount: posting.units?.units.toString() ?? "",
      currency: posting.units?.currency ?? "",
    }));
    if (draft.postings.length < 2) {
      while (draft.postings.length < 2) {
        draft.postings.push({ account: "", amount: "", currency: "" });
      }
    }
  } else if (value instanceof Open) {
    draft.account = value.account;
    draft.currencies = [...value.currencies];
    draft.booking = (value.booking as BookingMethod | undefined) ?? "";
    draft.color = isHexColor(metadata.color)
      ? metadata.color.toUpperCase()
      : "";
    draft.icon = typeof metadata.icon === "string" ? metadata.icon : "";
    draft.merchantId =
      typeof metadata.merchant_id === "string" ? metadata.merchant_id : "";
  } else if (value instanceof Close) {
    draft.account = value.account;
  } else if (value instanceof Commodity) {
    draft.currency = value.currency;
  } else if (value instanceof Pad) {
    // Domain Pad(account, sourceAccount) is loaded from parser Pad(source, target).
    draft.account = value.account;
    draft.account2 = value.sourceAccount;
  } else if (value instanceof Balance) {
    draft.account = value.account;
    draft.amount = value.amount.units.toString();
    draft.currency = value.amount.currency ?? "";
    draft.tolerance = value.tolerance ?? "";
  } else if (value instanceof Price) {
    draft.currency = value.currency;
    draft.amount = value.amount.units.toString();
    draft.currency2 = value.amount.currency ?? "";
  } else if (value instanceof Note) {
    draft.account = value.account;
    draft.comment = value.comment;
    draft.tags = [...value.tags];
    draft.links = [...value.links];
  } else if (value instanceof Document) {
    draft.account = value.account;
    draft.path = value.filename;
    draft.tags = [...value.tags];
    draft.links = [...value.links];
  } else if (value instanceof Event) {
    draft.eventType = value.type;
    draft.description = value.description;
  } else if (value instanceof Query) {
    draft.name = value.name;
    draft.query = String(value.queryString ?? "");
  } else if (value instanceof Custom) {
    draft.customType = value.type;
    draft.customValues = value.values.map((item) => String(item));
  }

  return draft;
}

function metadataFromDraft(draft: DirectiveDraft, existing: Attributes) {
  const rows = draft.metadata
    .map((row) => ({
      key: row.key.trim(),
      value: row.value,
    }))
    .filter((row) => row.key);

  if (draft.kind === "open") {
    if (isHexColor(draft.color)) {
      rows.push({ key: "color", value: draft.color.toUpperCase() });
    }
    const icon = draft.icon.trim();
    if (icon) rows.push({ key: "icon", value: icon });
    const merchantId = draft.merchantId.trim();
    if (merchantId) rows.push({ key: "merchant_id", value: merchantId });
  }

  const attributes = rows.map((row) => {
    const previous = existing.get(row.key);
    if (previous) return previous.copy({ value: row.value });
    return new Attribute(new Position(0, 0, 0), row.key, row.value);
  });
  return new Attributes(attributes);
}

function withCommon(
  source: DatedDirective,
  draft: DirectiveDraft,
  patch: Record<string, unknown>,
) {
  return source
    .copy({
      date: parseDate(draft.date),
      metadata: metadataFromDraft(draft, source.metadata),
      ...patch,
    })
    .toString();
}

export function tryParseDirectiveDraft(
  source: string,
  expectedKind: DirectiveKind,
): { draft: DirectiveDraft; directive: DirectiveBase } | null {
  if (expectedKind === "unknown") return null;
  try {
    // Snippets often fail booking/account validation outside the full ledger;
    // only require a matching dated directive with parser AST.
    const ledger = new LedgerSource(source);
    const match = ledger.directives.find(
      (entry) => directiveKind(entry) === expectedKind,
    );
    if (!match || !hasEditableAst(match)) return null;
    return { draft: loadDirectiveDraft(match), directive: match };
  } catch {
    return null;
  }
}

export function buildDirectiveSource(
  directive: DirectiveBase,
  draft: DirectiveDraft,
): string {
  const source = directive.source?.directive;
  if (!source) {
    throw new Error("This record has no editable parser source.");
  }

  if (
    directive instanceof Transaction &&
    source instanceof TransactionDirective
  ) {
    const flag = draft.flag.trim();
    if (flag.length > 1) {
      throw new Error("The transaction flag must be one character.");
    }
    if (!draft.narration.trim()) throw new Error("Narration is required.");
    if (draft.postings.length < 2) {
      throw new Error("Transactions need at least two postings.");
    }

    let inferred = 0;
    const postings = draft.postings.map((posting, index) => {
      const account = posting.account.trim();
      const amount = posting.amount.trim();
      const currency = posting.currency.trim();
      if (!account) throw new Error(`Posting ${index + 1} needs an account.`);
      if (Boolean(amount) !== Boolean(currency)) {
        throw new Error(
          `Posting ${index + 1} needs both an amount and a currency.`,
        );
      }
      let parsedAmount: ParserAmount | null = null;
      if (amount) {
        const value = parseNumber(amount);
        if (!value) {
          throw new Error(`Posting ${index + 1} has an invalid amount.`);
        }
        parsedAmount = new ParserAmount(value, currency);
      } else {
        inferred += 1;
      }
      if (inferred > 1) {
        throw new Error("Only one posting may have an inferred amount.");
      }
      const existing = source.postings[index];
      return existing
        ? existing.copy({ account, amount: parsedAmount })
        : new ParserPosting(new Position(0, 0, 0), "", account, parsedAmount);
    });

    return withCommon(source, draft, {
      status: flag,
      payee: draft.payee.trim(),
      narrative: draft.narration.trim(),
      tags: tagsFromDraft(draft.tags),
      links: linksFromDraft(draft.links),
      postings,
    });
  }

  if (directive instanceof Open && source instanceof OpenDirective) {
    const booking = draft.booking || "DEFAULT";
    return withCommon(source, draft, {
      account: requireAccount(draft.account),
      currencies: draft.currencies.map((item) => item.trim()).filter(Boolean),
      bookingMethod: booking,
    });
  }

  if (directive instanceof Close && source instanceof CloseDirective) {
    return withCommon(source, draft, {
      account: requireAccount(draft.account),
    });
  }

  if (directive instanceof Commodity && source instanceof CommodityDirective) {
    const currency = draft.currency.trim();
    if (!currency) throw new Error("Currency is required.");
    return withCommon(source, draft, { currency });
  }

  if (directive instanceof Pad && source instanceof PadDirective) {
    return withCommon(source, draft, {
      source: requireAccount(draft.account, "Source account"),
      target: requireAccount(draft.account2, "Target account"),
    });
  }

  if (directive instanceof Balance && source instanceof BalanceDirective) {
    const amount = parseAmountPair(draft.amount, draft.currency, "Balance");
    const toleranceText = draft.tolerance.trim();
    const tolerance = toleranceText ? parseNumber(toleranceText) : undefined;
    if (toleranceText && !tolerance) {
      throw new Error("Tolerance has an invalid amount.");
    }
    // BalanceDirective.copy cannot clear tolerance via `??`, so reconstruct.
    return new BalanceDirective(
      source.position,
      parseDate(draft.date),
      requireAccount(draft.account),
      amount,
      tolerance ?? undefined,
      metadataFromDraft(draft, source.metadata),
      source.comments,
    ).toString();
  }

  if (directive instanceof Price && source instanceof PriceDirective) {
    const currency = draft.currency.trim();
    if (!currency) throw new Error("Currency is required.");
    return withCommon(source, draft, {
      currency,
      amount: parseAmountPair(draft.amount, draft.currency2, "Price"),
    });
  }

  if (directive instanceof Note && source instanceof NoteDirective) {
    if (!draft.comment.trim()) throw new Error("Comment is required.");
    return withCommon(source, draft, {
      account: requireAccount(draft.account),
      narrative: draft.comment.trim(),
      tags: tagsFromDraft(draft.tags),
      links: linksFromDraft(draft.links),
    });
  }

  if (directive instanceof Document && source instanceof DocumentDirective) {
    if (!draft.path.trim()) throw new Error("Path is required.");
    return withCommon(source, draft, {
      account: requireAccount(draft.account),
      path: draft.path.trim(),
      tags: tagsFromDraft(draft.tags),
      links: linksFromDraft(draft.links),
    });
  }

  if (directive instanceof Event && source instanceof EventDirective) {
    if (!draft.eventType.trim()) throw new Error("Event type is required.");
    if (!draft.description.trim()) throw new Error("Description is required.");
    return withCommon(source, draft, {
      eventType: draft.eventType.trim(),
      description: draft.description.trim(),
    });
  }

  if (directive instanceof Query && source instanceof QueryDirective) {
    if (!draft.name.trim()) throw new Error("Name is required.");
    if (!draft.query.trim()) throw new Error("Query is required.");
    return withCommon(source, draft, {
      name: draft.name.trim(),
      query: draft.query.trim(),
    });
  }

  if (directive instanceof Custom && source instanceof CustomDirective) {
    if (!draft.customType.trim()) throw new Error("Type is required.");
    return withCommon(source, draft, {
      name: draft.customType.trim(),
      args: draft.customValues.map((item) => item.trim()).filter(Boolean),
    });
  }

  throw new Error("This record type cannot be edited as a form yet.");
}
