import * as beancount from "@beancount-js/beancount";

import { DateTime } from "luxon";
import {
  AttributeColumn,
  AttributeGetter,
  createFunction,
  typedTupleToColumns,
} from "../query/nodes";
import { Decimal } from "@beancount-js/parser";
import { Column, EntityTable, Table } from "../query/models";
import type { TableProps } from "../query/models";
import { Context } from "../query/Context";
import {
  EvalNode,
  getValueByDotNotation,
  registerAlias,
  registerStructure,
  Structure,
  type DType,
} from "../query/types";
import { leaf, parent } from "../query/query_env";
import { getActiveContext } from "../query/active_context";

export class Row {
  rowId: number = 0;
  entry!: beancount.Transaction;
  posting!: beancount.Posting;
  readonly balance: beancount.Inventory = new beancount.Inventory();
  constructor() {}
}

export class TimeStamp extends Structure {
  public static name = "timestamp";
  public static columns = typedTupleToColumns({
    year: Number,
    month: Number,
    day: Number,
    ordinal: Number,
    weekYear: Number,
    localWeekYear: Number,
    weekNumber: Number,
    localWeekNumber: Number,
    weekday: Number,
    localWeekday: Number,
    quarter: Number,
  });
  public static wildcardColumns: string[] = ["year", "month", "day"];
}

export class Position extends Structure {
  public static name = "position";
  public static columns = typedTupleToColumns(beancount.Position.typings());
}

export class Cost extends Structure {
  public static name = "cost";
  public static columns = typedTupleToColumns(beancount.Cost.typings());
}

export class Amount extends Structure {
  public static name = "amount";
  public static columns = typedTupleToColumns(beancount.Amount.typings());
}

export class Transaction extends Structure {
  public static name = "transaction";
  public static columns = typedTupleToColumns(beancount.Transaction.typings(), [
    new AttributeGetter(
      "accounts",
      [String],
      (context: beancount.Transaction) =>
        context.postings.map((it) => it.account),
    ),
  ]);
}

export class Account extends Structure {
  public static name = "account";
  public static typing: DType = String;
  public static columns = typedTupleToColumns({}, [
    new AttributeGetter(
      "type",
      String,
      (context: string) => context.split(":", 2)[0],
    ),
    new AttributeGetter("parent", String, parent),
    new AttributeGetter("leaf", String, leaf),
    new AttributeGetter("length", Number, (str: string) => str.length),
  ]);

  constructor() {
    super();
  }
}

registerAlias(Account, String);
registerStructure(Account, Account);

registerStructure(DateTime, TimeStamp);
registerStructure(beancount.Position, Position);
registerStructure(beancount.Cost, Cost);
registerStructure(beancount.Amount, Amount);
registerStructure(beancount.Transaction, Transaction);
registerStructure(DateTime, TimeStamp);

export class Open extends Structure {
  public static name = "open";
  public static columns = typedTupleToColumns(beancount.Open.typings());
}

export class Close extends Structure {
  public static name = "close";
  public static columns = typedTupleToColumns(beancount.Close.typings());
}

export class BeancountTable extends Table {
  public context!: Context;

  copy(
    props: Partial<{
      name: string;
      columns:
        | Record<string, EvalNode>
        | AttributeColumn[]
        | Map<string, EvalNode>;
      wildcardColumns: string[];
      joins: Map<string, Table>;
      props: Partial<TableProps>;
      context: Context;
    }> = {},
  ) {
    const table = new BeancountTable(
      props.name ?? this.name,
      props.columns ?? this.columns,
      props.wildcardColumns ?? this.wildcardColumns,
      props.props ? { ...this.props, ...props.props } : this.props,
    );
    const entries = props.joins ? props.joins.entries() : this.joins.entries();
    for (const [k, v] of entries) {
      table.joins.set(k, v.copy());
    }
    table.setContext(props.context ?? this.context);
    return table;
  }

  setContext(context: Context) {
    this.context = context;
  }

  prepare(): beancount.Directives {
    let entries = super.prepare() as beancount.Directives;
    if (this.open instanceof DateTime) {
      const [openEntries] = beancount.openOpts(
        entries,
        this.open,
        this.context.options,
      );
      entries = openEntries;
    }
    if (this.close) {
      if (this.close instanceof DateTime) {
        const [closeEntries] = beancount.closeOpts(
          entries,
          this.close,
          this.context.options,
        );
        entries = closeEntries;
      } else {
        const [closeEntries] = beancount.closeOpts(
          entries,
          null,
          this.context.options,
        );
        entries = closeEntries;
      }
    }

    if (this.clear) {
      const [clearEntries] = beancount.clearOpts(
        entries,
        null,
        this.context.options,
      );
      entries = clearEntries;
    }
    return entries;
  }
}

export class TransactionsTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Transaction;
  constructor(data: beancount.Directive[]) {
    super(
      "transactions",
      Transaction.columns,
      ["date", "flag", "payee", "narration", "tags", "links"],
      { data: data.filter((it) => it instanceof beancount.Transaction) },
    );
  }
}

export class PricesTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Price;
  priceMap: beancount.PriceMap;

  constructor(data: beancount.Directive[]) {
    super(
      "prices",
      typedTupleToColumns(beancount.Price.typings()),
      ["date", "currency", "amount"],
      { data: data.filter((it) => it instanceof beancount.Price) },
    );
    this.priceMap = new beancount.PriceMap(data);
  }
}

export class BalancesTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Balance;
  constructor(data: beancount.Directive[]) {
    super(
      "balances",
      typedTupleToColumns(beancount.Balance.typings(), [], {
        diff: "discrepancy",
      }),
      ["date", "currency", "amount"],
      { data: data.filter((it) => it instanceof beancount.Balance) },
    );
  }
}

export class NotesTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Note;

  constructor(data: beancount.Directive[]) {
    super(
      "notes",
      typedTupleToColumns(beancount.Note.typings()),
      ["date", "account", "comment", "tags", "links"],
      { data: data.filter((it) => it instanceof beancount.Note) },
    );
  }
}

export class EventsTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Event;

  constructor(data: beancount.Directive[]) {
    super(
      "events",
      typedTupleToColumns(beancount.Event.typings()),
      ["date", "type", "description"],
      { data: data.filter((it) => it instanceof beancount.Event) },
    );
  }
}

export class DocumentsTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Document;

  constructor(data: beancount.Directive[]) {
    super(
      "documents",
      typedTupleToColumns(beancount.Document.typings()),
      ["date", "account", "filename", "tags", "links"],
      { data: data.filter((it) => it instanceof beancount.Document) },
    );
  }
}

function accountsFor(directives: beancount.Directives) {
  const accounts = beancount.accountOpenClose(directives);
  const entries: Array<{
    open: beancount.Open | null;
    close: beancount.Close | null;
    account: string;
    updatedAt: DateTime;
  }> = [];
  for (const [key, value] of Object.entries(accounts)) {
    entries.push({ ...value, account: key });
  }
  return entries;
}

export class AccountsTable extends BeancountTable {
  public static dataType: beancount.Typing = beancount.Document;

  constructor(data: beancount.Directive[]) {
    super(
      "accounts",
      typedTupleToColumns({
        account: String,
        open: Open,
        close: Close,
        updated: DateTime,
      }),
      ["account"],
      { data: accountsFor(data) },
    );
  }

  #accountTypes: beancount.AccountTypes;
  get accountTypes() {
    if (!this.#accountTypes) {
      this.#accountTypes = new beancount.AccountTypes(this.context.options);
    }
    return this.#accountTypes;
  }
}

@EntityTable
export class EntriesTable extends BeancountTable {
  constructor(data: beancount.Directive[]) {
    super("entries", [], ["date", "flag", "payee", "narration"], { data });
  }

  @Column(String)
  id(entry: beancount.DirectiveBase) {
    return entry.id;
  }

  @Column(String)
  type(entry: beancount.DirectiveBase) {
    return entry.directiveType;
  }

  @Column(String)
  filename(entry: beancount.DirectiveBase) {
    return entry.meta["filename"];
  }

  @Column(Number)
  lineno(entry: beancount.DirectiveBase) {
    return entry.lineno;
  }

  @Column(DateTime)
  date(entry: beancount.DirectiveBase) {
    return entry.date;
  }

  @Column(Number)
  year(entry: beancount.DirectiveBase) {
    return entry.date?.year;
  }

  @Column(Number)
  month(entry: beancount.DirectiveBase) {
    return entry.date?.month;
  }

  @Column(Number)
  day(entry: beancount.DirectiveBase) {
    return entry.date?.day;
  }

  @Column(String)
  flag(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return entry.flag;
  }

  @Column(String)
  payee(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return entry.payee;
  }

  @Column(String)
  narration(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return entry.narration;
  }

  @Column(String)
  description(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return [entry.payee, entry.narration].filter((it) => it).join(" | ");
  }

  @Column([String])
  tags(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return entry.tags;
  }

  @Column([String])
  links(entry: beancount.DirectiveBase) {
    if (!(entry instanceof beancount.Transaction)) {
      return null;
    }
    return entry.links;
  }

  @Column(Object)
  meta(entry: beancount.DirectiveBase) {
    return entry.meta;
  }

  @Column([String])
  accounts(entry: beancount.DirectiveBase) {
    return entry.accounts;
  }
}

@EntityTable
export class PostingsTable extends BeancountTable {
  constructor(data: beancount.Directive[]) {
    super("postings", [], ["date", "flag", "payee", "narration", "position"], {
      data,
    });
  }

  *[Symbol.iterator]() {
    for (const [i, entry] of this.prepare().entries()) {
      if (entry instanceof beancount.Transaction) {
        for (const posting of entry.postings) {
          const context = new Row();
          context.entry = entry;
          context.rowId = i + 1;
          context.posting = posting;
          yield context;
        }
      }
    }
  }

  @Column(String)
  id(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "id");
    }
    return context.entry.id;
  }

  @Column(String)
  type(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "type");
    }
    return context.entry.directiveType;
  }

  @Column(String)
  filename(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "filename");
    }
    return context.posting.meta["filename"];
  }

  @Column(Number)
  lineno(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "lineno");
    }
    return context.posting.meta["lineno"] ?? context.entry.lineno;
  }

  @Column(DateTime)
  date(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "date");
    }
    return context.entry.date;
  }

  @Column(Number)
  year(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "year");
    }
    return context.entry.date?.year;
  }

  @Column(Number)
  month(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "month");
    }
    return context.entry.date?.month;
  }

  @Column(Number)
  day(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "day");
    }
    return context.entry.date?.day;
  }

  @Column(String)
  flag(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "flag");
    }
    return context.entry.flag;
  }

  @Column(String, "posting_flag")
  postingFlag(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "posting_flag");
    }
    return context.posting.flag;
  }

  @Column(String)
  payee(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "payee");
    }
    return context.entry.payee;
  }

  @Column(String)
  narration(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "narration");
    }
    return context.entry.narration;
  }

  @Column(String)
  description(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "description");
    }
    return [context.entry.payee, context.entry.narration]
      .filter((it) => it)
      .join(" | ");
  }

  @Column([String])
  tags(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "balance") ?? [];
    }
    return context.entry.tags;
  }

  @Column([String])
  links(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "links") ?? [];
    }
    return context.entry.links;
  }

  @Column(Object)
  meta(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "meta") ?? {};
    }
    return context.posting.meta;
  }

  @Column(Account)
  account(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "account");
    }
    return context.posting.account;
  }

  @Column([String])
  accounts(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "accounts");
    }
    return context.entry.accounts;
  }

  @Column([String], "other_accounts")
  otherAccounts(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "other_accounts");
    }
    return context.entry.accounts.filter(
      (it) => it !== context.posting.account,
    );
  }

  @Column(Decimal)
  number(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "number");
    }
    return context.posting.units.value;
  }

  @Column(String)
  currency(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "currency");
    }
    return context.posting.units.currency;
  }

  @Column(Decimal, "cost_number")
  costNumber(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "cost_number");
    }
    const cost = context.posting.cost;
    if (cost instanceof beancount.Cost) {
      return cost.amount.value;
    }
    return null;
  }

  @Column(String, "cost_currency")
  costCurrency(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "cost_currency");
    }
    const cost = context.posting.cost;
    if (cost instanceof beancount.Cost) {
      return cost.amount.currency;
    }
    return null;
  }

  @Column(DateTime, "cost_date")
  costDate(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "cost_date");
    }
    const cost = context.posting.cost;
    if (cost instanceof beancount.Cost) {
      return cost.date;
    }
    return null;
  }

  @Column(DateTime, "cost_label")
  costLabel(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "cost_label");
    }
    return context.posting.cost.label;
  }

  @Column(beancount.Position)
  position(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "position");
    }
    const cost = context.posting.cost;
    if (cost instanceof beancount.Cost) {
      return new beancount.Position(context.posting.units, cost);
    }
    return new beancount.Position(context.posting.units);
  }

  @Column(beancount.Amount)
  price(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "price");
    }
    return context.posting.price;
  }

  _balance: beancount.Inventory;
  @Column(beancount.Inventory)
  balance(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return (
        getValueByDotNotation(context, "balance") ?? new beancount.Inventory()
      );
    }
    if (this._balance) {
      return this._balance;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pos = this.position(context) as any;
    if (pos.units) {
      context.balance.addPosition(pos);
    }
    this._balance = context.balance.copy();
    return this._balance;
  }

  @Column(beancount.Transaction)
  entry(context: Row | Record<string, unknown>) {
    if (!(context instanceof Row)) {
      return getValueByDotNotation(context, "entry");
    }
    return context.entry;
  }
}

type TableType = new (data: beancount.DirectiveBase[]) => BeancountTable;
export const TABLES: Array<TableType> = [
  EntriesTable,
  TransactionsTable,
  PostingsTable,
  AccountsTable,
  DocumentsTable,
  EventsTable,
  NotesTable,
  BalancesTable,
  PricesTable,
];

export function createDatabase(
  data: Array<beancount.DirectiveBase> | string,
  props: Partial<{
    options: beancount.BeancountOptions;
    errors: beancount.LedgerError[];
    parser: Partial<beancount.LoadProps>;
  }> = {},
) {
  if (typeof data === "string") {
    if (!data) {
      return new Context(
        props.options ?? beancount.defaultBeancountOptions(),
        props.errors ?? [],
        ...TABLES.map((table) => new table([])),
      );
    }
    const [directives, errors, options] = beancount.loadString(
      data,
      props.parser,
    );
    return createDatabase(directives, { options, errors });
  }
  return new Context(
    props.options ?? beancount.defaultBeancountOptions(),
    props.errors ?? [],
    ...TABLES.map((table) => new table(data)),
  );
}

createFunction("account_sortkey", [String], String, accountSortKey, false);
function accountSortKey(context: Context, account: string) {
  const accounts = context.tables.get("accounts") as AccountsTable;
  return accounts.accountTypes.sortKey(account).join("-");
}

function getPriceMap(): beancount.PriceMap {
  const ctx = getActiveContext();
  const table = ctx?.tables.get("prices") as PricesTable | undefined;
  return table?.priceMap ?? new beancount.PriceMap([]);
}

function toCounterInventory(
  value: beancount.Inventory | beancount.Position | beancount.Amount,
): beancount.CounterInventory {
  const counter = new beancount.CounterInventory();
  if (value instanceof beancount.Inventory) {
    for (const pos of value.values()) {
      counter.add(pos.units, pos.cost);
    }
  } else if (value instanceof beancount.Position) {
    counter.add(value.units, value.cost);
  } else if (value instanceof beancount.Amount) {
    counter.add(value);
  }
  return counter;
}

function counterToInventory(
  counter: beancount.CounterInventory | beancount.SimpleCounterInventory,
): beancount.Inventory {
  const inventory = new beancount.Inventory();
  for (const pos of counter.positions()) {
    inventory.addPosition(pos);
  }
  return inventory;
}

function convertInventory(
  value: beancount.Inventory | beancount.Position | beancount.Amount,
  conversion: beancount.Conversion,
  date?: DateTime,
): beancount.Inventory | beancount.Position | beancount.Amount | null {
  const counter = toCounterInventory(value);
  const result = beancount.costOrValue(counter, conversion, {
    prices: getPriceMap(),
    date: date ?? DateTime.utc(),
  });
  const positions = result.positions();
  if (positions.length === 1) {
    return positions[0];
  }
  if (!positions.length) {
    return null;
  }
  return counterToInventory(result);
}

createFunction("units", [beancount.Inventory], beancount.Inventory, unitsFn, true);
createFunction("units", [beancount.Position], beancount.Position, unitsFn, true);
createFunction("units", [beancount.Amount], beancount.Amount, unitsFn, true);
function unitsFn(value: beancount.Inventory | beancount.Position | beancount.Amount) {
  return convertInventory(value, beancount.Conversion.UNITS);
}

createFunction("value", [beancount.Inventory], beancount.Inventory, valueFn, true);
createFunction("value", [beancount.Position], beancount.Position, valueFn, true);
createFunction("value", [beancount.Amount], beancount.Amount, valueFn, true);
createFunction(
  "value",
  [beancount.Inventory, DateTime],
  beancount.Inventory,
  valueAtFn,
  true,
);
createFunction(
  "value",
  [beancount.Position, DateTime],
  beancount.Position,
  valueAtFn,
  true,
);
function valueFn(value: beancount.Inventory | beancount.Position | beancount.Amount) {
  return convertInventory(value, beancount.Conversion.AT_VALUE);
}
function valueAtFn(
  value: beancount.Inventory | beancount.Position | beancount.Amount,
  date: DateTime,
) {
  return convertInventory(value, beancount.Conversion.AT_VALUE, date);
}

createFunction("getprice", [String, String], Decimal, getpriceFn, true);
createFunction("getprice", [String, String, DateTime], Decimal, getpriceAtFn, true);
function getpriceFn(currency: string, costCurrency: string) {
  return getpriceAtFn(currency, costCurrency, DateTime.utc());
}
function getpriceAtFn(
  currency: string,
  costCurrency: string,
  date: DateTime,
) {
  const quote = new beancount.BaseQuote(currency, costCurrency);
  return getPriceMap().getPrice(quote, date) ?? null;
}
