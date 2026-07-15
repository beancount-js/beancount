import {
  Decimal,
  formatDate,
  writeString,
  checksum,
} from "@beancount-js/parser";
import { Amount } from "./amount";
import { DateTime } from "luxon";
import { Cost, CostSpec } from "./position";
import { LedgerEntry } from "../parser/parser";

type ScalarType =
  | string
  | number
  | boolean
  | DateTime
  | Decimal
  | null
  | Amount
  | undefined;

export { type ScalarType };

export type Metadata = Record<
  string,
  ScalarType | Record<string, ScalarType> | unknown
>;

export type Currency = string;

export type Account = string;

export type Flag = string;

// Special flags.
// Transactions that have been checked.
export const FLAG_OKAY = "*";
// Mark by the user as something to be looked at later on.
export const FLAG_WARNING = "!";
// Transactions created from padding directives.
export const FLAG_PADDING = "P";
// Transactions created due to summarization.
export const FLAG_SUMMARIZE = "S";
// Transactions created due to balance transfers.
export const FLAG_TRANSFER = "T";
// Transactions created to account for price conversions.
export const FLAG_CONVERSIONS = "C";
// A flag to mark postings merging together legs for average cost.
export const FLAG_MERGING = "M";
export const FLAG_UNREALIZED = "U";

export const SOURCE_META = "__source__";
export const DIRECTIVE_META = "__directive__";

// A set of valid booking method names for positions on accounts.
export enum Booking {
  // Reject ambiguous matches with an error.
  STRICT = "STRICT",

  // Strict booking method, but disambiguate further with sizes. Reject
  // ambiguous matches with an error but if a lot matches the size exactly,
  // accept it the oldest.
  STRICT_WITH_SIZE = "STRICT_WITH_SIZE",

  // Disable matching and accept the creation of mixed inventories.
  NONE = "NONE",

  // Average cost booking: merge all matching lots before and after.
  AVERAGE = "AVERAGE",

  // First-in first-out in the case of ambiguity.
  FIFO = "FIFO",

  // Last-in first-out in the case of ambiguity.
  LIFO = "LIFO",

  // Highest-in first-out in the case of ambiguity.
  HIFO = "HIFO",
}

function isScalar(object: unknown): object is ScalarType {
  if (
    typeof object === "string" ||
    typeof object === "number" ||
    typeof object === "boolean"
  ) {
    return true;
  } else if (object instanceof DateTime) {
    return true;
  } else if (object instanceof Decimal) {
    return true;
  } else if (object instanceof Amount) {
    return true;
  }
  return false;
}

function stringifyMeta(metadata: Metadata, indent: number = 2) {
  const pad = " ".repeat(indent);
  let str = "";
  for (const [key, value] of Object.entries(metadata)) {
    if (
      key.match(/^[a-z][a-zA-Z0-9_-]*$/) &&
      isScalar(value) &&
      !key.match(/(^(lineno|filename|file)$)|(^_)/)
    ) {
      str += "\n" + pad + `${key}: ${writeScalar(value)}`;
    }
  }
  return str;
}

export function writeScalar(value: ScalarType | Array<ScalarType>): string {
  if (Array.isArray(value)) {
    return value.map((it) => writeScalar(it)).join(" ");
  }

  if (value == null || value === undefined) {
    return "";
  } else if (typeof value === "string") {
    return writeString(value);
  }

  if (value instanceof DateTime) {
    return formatDate(value);
  }

  return value.toString();
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type Typing = Function | [Typing] | Array<Typing>;

export abstract class DirectiveBase {
  abstract get accounts(): ReadonlyArray<string>;
  abstract get directiveType(): string;
  constructor(
    readonly meta: Metadata = {},
    readonly date: DateTime | null = null,
  ) {}

  #id: string = "";
  get id() {
    if (this.#id === "") {
      this.#id = checksum(this.content);
    }
    return this.#id;
  }

  get lineno() {
    return +(this.meta["lineno"] ?? 0);
  }

  get content(): string {
    if (this.meta[SOURCE_META]) {
      return this.meta[SOURCE_META].toString();
    }
    return this.source?.content ?? this.toString();
  }

  get source(): LedgerEntry | null {
    const value = this.meta[DIRECTIVE_META];
    if (value && value instanceof LedgerEntry) {
      return value;
    }
    return null;
  }
}

/** An "open account" directive. */
export class Open extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the name of the account that is being opened.
   * @param currencies A list of strings, currencies that are allowed in this
   *   account. May be None, in which case it means that there are no
   *   restrictions on which currencies may be stored in this account.
   * @param booking A Booking enum, the booking method to use to disambiguate
   *   postings to this account (when zero or more than one postings match the
   *   specification), or None if not specified. In practice, this attribute
   *   will be should be left unspecified (None) in the vast majority of cases.
   *   See Booking below for a selection of valid methods.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Account,
    readonly currencies: ReadonlyArray<Currency> = [],
    readonly booking: Booking = Booking.STRICT,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      currencies: [String],
      booking: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "open";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  toString() {
    let str =
      `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.account} ${this.currencies.join(",")}`.trim();
    if (this.booking !== Booking.STRICT) {
      str += " " + this.booking;
    }
    str += stringifyMeta(this.meta);
    return str.trim();
  }
}

/** A "close account" directive. */
export class Close extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the name of the account that is being closed.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Currency,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "close";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.account} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * An optional commodity declaration directive. Commodities generally do not
 * need to be declared, but they may, and this is mainly created as intended to
 * be used to attach meta-data on a commodity name. Whenever a plugin needs
 * per-commodity meta-data, you would define such a commodity directive. Another
 * use is to define a commodity that isn't otherwise (yet) used anywhere in an
 * input file. (At the moment the date is meaningless but is specified for
 * coherence with all the other directives; if you can think of a good use case,
 * let us know).
 */
export class Commodity extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param currency A string, the commodity under consideration
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly currency: Currency,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      currency: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "commodity";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.currency} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * A "pad this account with this other account" directive. This directive
 * automatically inserts transactions that will make the next chronological
 * balance directive succeeds. It can be used to fill in missing date ranges of
 * transactions, as a convenience. You don't have to use this, it's sugar
 * coating in case you need it, while you're entering past history into your
 * Ledger.
 */
export class Pad extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the name of the account which needs to be filled.
   * @param sourceAccount A string, the name of the account which is used to
   *   debit from in order to fill 'account'.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Account,
    readonly sourceAccount: Account,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      sourceAccount: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "pad";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account, this.sourceAccount];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.sourceAccount} ${this.account} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * A "check the balance of this account" directive. This directive asserts that
 * the declared account should have a known number of units of a particular
 * currency at the beginning of its date. This is essentially an assertion, and
 * corresponds to the final "Statement Balance" line of a real-world statement.
 * These assertions act as checkpoints to help ensure that you have entered your
 * transactions correctly.
 */
export class Balance extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the account whose balance to check at the given
   *   date.
   * @param amount An Amount, the number of units of the given currency you're
   *   expecting 'account' to have at this date.
   * @param diff None if the balance check succeeds. This value is set to an
   *   Amount instance if the balance fails, the amount of the difference.
   * @param tolerance A Decimal object, the amount of tolerance to use in the
   *   verification.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Account,
    readonly amount: Amount,
    readonly diff: Amount | null = null,
    readonly tolerance: string = "",
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      amount: Amount,
      diff: Amount,
      tolerance: String,
      meta: Object,
    };
  }

  copy(
    data: Partial<{
      date: DateTime;
      account: Account;
      amount: Amount;
      diff: Amount | null;
      tolerance: string;
      meta: Metadata;
    }> = {},
  ) {
    return new Balance(
      data.date === undefined ? this.date : data.date,
      data.account === undefined ? this.account : data.account,
      data.amount === undefined ? this.amount : data.amount,
      data.diff === undefined ? this.diff : data.diff,
      data.tolerance === undefined ? this.tolerance : data.tolerance,
      data.meta === undefined ? { ...this.meta } : data.meta,
    );
  }

  get directiveType(): string {
    return "balance";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.account} ${this.amount} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * Postings are contained in Transaction entries. These represent the individual
 * legs of a transaction. Note: a posting may only appear within a single entry
 * (multiple transactions may not share a Posting instance), and that's what the
 * entry field should be set to.
 */
export class Posting {
  /**
   * @param account A string, the account that is modified by this posting
   * @param units An Amount, the units of the position, or None if it is to be
   *   inferred from the other postings in the transaction.
   * @param cost A Cost or CostSpec instances, the units of the position.
   * @param price An Amount, the price at which the position took place, or
   *   None, where not relevant. Providing a price member to a posting
   *   automatically adds a price in the prices database at the date of the
   *   transaction.
   * @param flag An optional flag, a one-character string or None, which is to
   *   be associated with the posting. Most postings don't have a flag, but it
   *   can be convenient to mark a particular posting as problematic or pending
   *   to be reconciled for a future import of its account.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly account: Account,
    readonly units: Amount | null = null,
    readonly cost: Cost | CostSpec | null = null,
    readonly price: Amount | null = null,
    readonly flag: Flag = "",
    readonly meta: Metadata = {},
  ) {}

  static typings(): Record<string, Typing> {
    return {
      account: String,
      units: Amount,
      cost: Cost,
      price: Amount,
      flag: String,
      meta: Object,
    };
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  public copy(
    data: Partial<{
      account: Account;
      units: Amount | null;
      cost: Cost | CostSpec | null;
      price: Amount | null;
      flag: Flag;
      meta: Metadata;
    }> = {},
  ) {
    return new Posting(
      data.account === undefined ? this.account : data.account,
      data.units === undefined ? this.units : data.units,
      data.cost === undefined ? this.cost : data.cost,
      data.price === undefined ? this.price : data.price,
      data.flag === undefined ? this.flag : data.flag,
      data.meta === undefined ? this.meta : data.meta,
    );
  }

  get resolvedCost(): Cost | null {
    if (!this.cost) {
      return null;
    } else if (this.cost instanceof Cost) {
      return this.cost;
    }

    return null;
  }

  toString(includeMeta: boolean = true) {
    let str = (this.flag + " " + this.account).trim();
    str += " " + (this.units || "").toString().trim();
    if (this.cost instanceof Cost) {
      str += " " + this.cost.toString(true).trim();
    } else if (this.cost instanceof CostSpec) {
      str += " " + this.cost.toString(true).trim();
    }
    if (this.price?.toString()) {
      str += " @ " + this.price.toString();
    }
    if (includeMeta) {
      str += stringifyMeta(this.meta, 4);
    }
    return "\n  " + str.trim();
  }
}

/**
 * A transaction! This is the main type of object that we manipulate, and the
 * entire reason this whole project exists in the first place, because
 * representing these types of structures with a spreadsheet is difficult.
 */
export class Transaction extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param flag A single-character string or None. This user-specified string
   *   represents some custom/user-defined state of the transaction. You can use
   *   this for various purposes. Otherwise common, pre-defined flags are
   *   defined under beancount.core.flags, to flags transactions that are
   *   automatically generated.
   * @param payee A free-form string that identifies the payee, or None, if
   *   absent.
   * @param narration A free-form string that provides a description for the
   *   transaction. All transactions have at least a narration string, this is
   *   never None.
   * @param tags A set of tag strings (without the '#')
   * @param links A set of link strings (without the '^')
   * @param postings A list of Posting instances, the legs of this transaction.
   *   See the doc under Posting above.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly flag: Flag = "",
    readonly payee: string = "",
    readonly narration: string = "",
    readonly tags: ReadonlyArray<string> = [],
    readonly links: ReadonlyArray<string> = [],
    readonly postings: ReadonlyArray<Posting> = [],
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      flag: String,
      payee: String,
      narration: String,
      tags: [String],
      links: [String],
      postings: [Posting],
      meta: Object,
    };
  }

  copy(
    data: Partial<{
      date: DateTime;
      flag: Flag;
      payee: string;
      narration: string;
      tags: Array<string>;
      links: Array<string>;
      postings: Array<Posting>;
      meta: Metadata;
    }> = {},
  ) {
    return new Transaction(
      data.date || this.date,
      data.flag === undefined ? this.flag : data.flag,
      data.payee === undefined ? this.payee : data.payee,
      data.narration === undefined ? this.narration : data.narration,
      data.tags === undefined ? [...this.tags] : data.tags,
      data.links === undefined ? [...this.links] : data.links,
      data.postings === undefined ? [...this.postings] : data.postings,
      data.meta === undefined ? { ...this.meta } : data.meta,
    );
  }

  get directiveType(): string {
    return "transaction";
  }

  get accounts(): ReadonlyArray<Account> {
    return [...new Set(this.postings.map((it) => it.account).flat())];
  }

  public toString() {
    let str = formatDate(this.date) + " " + this.flag;
    if (this.payee) {
      str += " " + writeString(this.payee);
    }
    if (this.narration) {
      str += " " + writeString(this.narration);
    }
    str +=
      " " +
      [...this.tags.map((it) => `#${it}`), ...this.links.map((it) => `^${it}`)]
        .join(" ")
        .trim();

    str += stringifyMeta(this.meta);
    str += this.postings.map((it) => it.toString()).join("");
    return str + "\n";
  }
}

/**
 * A pair of a Posting and its parent Transaction. This is inserted as
 * temporaries in lists of postings-of-entries, which is the product of a
 * realization.
 */
export class TxnPosting extends DirectiveBase {
  /**
   * @param txn The parent Transaction instance.
   * @param posting The Posting instance.
   */
  constructor(
    readonly txn: Transaction,
    readonly posting: Posting,
  ) {
    super(txn.meta, txn.date);
  }

  static typings(): Record<string, Typing> {
    return {
      ...Transaction.typings(),
      ...Posting.typings(),
    };
  }

  get accounts(): readonly string[] {
    return this.txn.accounts;
  }

  get directiveType(): string {
    return this.txn.directiveType;
  }

  copy(
    data: Partial<{
      txn: Transaction;
      posting: Posting;
    }> = {},
  ) {
    return new TxnPosting(
      data.txn ?? this.txn.copy(),
      data.posting ?? this.posting.copy(),
    );
  }
}

/**
 * A note directive, a general note that is attached to an account. These are
 * used to attach text at a particular date in a specific account. The notes can
 * be anything; a typical use would be to jot down an answer from a phone call
 * to the institution represented by the account. It should show up in an
 * account's journal. If you don't want this rendered, use the comment syntax in
 * the input file, which does not get parsed and stored.
 */
export class Note extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the account which the note is to be attached to.
   *   This is never None, notes always have an account they correspond to.
   * @param comment A free-form string, the text of the note. This can be long
   *   if you want it to.
   * @param tags A set of tag strings (without the '#')
   * @param links A set of link strings (without the '^')
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Account,
    readonly comment: string,
    readonly tags: ReadonlyArray<string> = [],
    readonly links: ReadonlyArray<string> = [],
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      comment: String,
      tags: [String],
      links: [String],
      meta: Object,
    };
  }

  get directiveType(): string {
    return "note";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  toString() {
    let str =
      `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.account} ${writeString(this.comment)}`.trim();
    str +=
      " " +
      [...this.tags.map((it) => `#${it}`), ...this.links.map((it) => `^${it}`)]
        .join(" ")
        .trim();
    str += " " + stringifyMeta(this.meta);
    return str.trim();
  }
}

/**
 * An "event value change" directive. These directives are used as string
 * variables that have different values over time. You can use these to track an
 * address, your location, your current employer, anything you like. The kind of
 * reporting that is made of these generic events is based on days and a
 * timeline. For instance, if you need to track the number of days you spend in
 * each country or state, create a "location" event and whenever you travel, add
 * an event directive to indicate its new value. You should be able to write
 * simple scripts against those in order to compute if you were present
 * somewhere for a particular number of days. Here's an illustrative example
 * usage, in order to maintain your health insurance coverage in Canada, you
 * need to be present in the country for 183 days or more, excluding trips of
 * less than 30 days. There is a similar test to be done in the US by aliens to
 * figure out if they need to be considered as residents for tax purposes (the
 * so-called "substantial presence test"). By integrating these directives into
 * your bookkeeping, you can easily have a little program that computes the
 * tests for you. This is, of course, entirely optional and somewhat auxiliary
 * to the main purpose of double-entry bookkeeping, but correlates strongly with
 * the transactions you insert in it, and so it's a really convenient thing to
 * have in the same input file.
 */
export class Event extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param type A short string, typically a single lowercase word, that defines
   *   a unique variable whose value changes over time. For example,
   *   'location'.
   * @param description A free-form string, the value of the variable as of the
   *   date of the transaction.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly type: string,
    readonly description: string,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      type: String,
      description: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "event";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${writeString(this.type)} ${writeString(this.description)} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * A named query declaration. This directive is used to create pre-canned
 * queries that can then be automatically run or made available to the shell, or
 * perhaps be rendered as part of a web interface. The purpose of this routine
 * is to define useful queries for the context of the particular given Beancount
 * input file.
 */
export class Query extends DirectiveBase {
  /**
   * @param date The date at which this query should be run. All directives
   *   following this date will be ignored automatically. This is essentially
   *   equivalent to the CLOSE modifier in the shell syntax.
   * @param name A string, the unique identifier for the query.
   * @param queryString The SQL query string to be run or made available.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly name: string,
    readonly queryString: string | CodeBlock,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      name: String,
      queryString: [String, CodeBlock],
      meta: Object,
    };
  }

  get directiveType(): string {
    return "query";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  get query() {
    return this.queryString.toString();
  }

  toString() {
    const value =
      typeof this.queryString === "string"
        ? writeString(this.queryString)
        : this.queryString.toString();
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${writeString(this.name)} ${value} ${stringifyMeta(this.meta)}`.trim();
  }
}

export class CodeBlock {
  constructor(
    readonly code: string,
    readonly language: string,
    readonly source: string,
  ) {}

  public toString() {
    return this.source;
  }
}

export class LedgerOption extends DirectiveBase {
  readonly date: DateTime | null = null;
  constructor(
    readonly key: string,
    readonly value: string,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      key: String,
      value: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "option";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${this.directiveType} ${writeString(this.key)} ${writeString(this.value)} ${stringifyMeta(this.meta)}`.trim();
  }
}

export class LedgerInclude extends DirectiveBase {
  readonly date: DateTime | null = null;

  constructor(
    readonly path: string,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      path: String,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "include";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${this.directiveType} ${writeString(this.path)} ${stringifyMeta(this.meta)}`.trim();
  }
}

export class Plugin extends DirectiveBase {
  readonly date: DateTime | null = null;

  constructor(
    readonly name: string,
    readonly options?: string | CodeBlock,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      name: String,
      options: [String, CodeBlock],
      meta: Object,
    };
  }

  get directiveType(): string {
    return "plugin";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    const opt = this.options
      ? typeof this.options === "string"
        ? writeString(this.options)
        : this.options.toString()
      : "";
    return `${this.directiveType} ${(writeString(this.name) + " " + opt).trim()}${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * A price declaration directive. This establishes the price of a currency in
 * terms of another currency as of the directive's date. A history of the prices
 * for each currency pairs is built and can be queried within the bookkeeping
 * system. Note that because Beancount does not store any data at time-of-day
 * resolution, it makes no sense to have multiple price directives at the same
 * date. (Beancount will not attempt to solve this problem; this is beyond the
 * general scope of double-entry bookkeeping and if you need to build a day
 * trading system, you should probably use something else).
 */
export class Price extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param currency A string, the currency that is being priced, e.g. HOOL.
   * @param amount An instance of Amount, the number of units and currency that
   *   'currency' is worth, for instance 1200.12 USD.
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly currency: Currency,
    readonly amount: Amount,
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      currency: String,
      amount: Amount,
      meta: Object,
    };
  }

  get directiveType(): string {
    return "price";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.currency} ${this.amount} ${stringifyMeta(this.meta)}`.trim();
  }
}

/**
 * A document file declaration directive. This directive is used to attach a
 * statement to an account, at a particular date. A typical usage would be to
 * render PDF files or scans of your bank statements into the account's journal.
 * While you can explicitly create those directives in the input syntax, it is
 * much more convenient to provide Beancount with a root directory to search for
 * filenames in a hierarchy mirroring the chart of accounts, filenames which
 * should match the following dated format: "YYYY-MM-DD.*". See options for
 * detail. Beancount will automatically create these documents directives based
 * on the file hierarchy, and you can get them by parsing the list of entries.
 */
export class Document extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param account A string, the account which the statement or document is
   *   associated with.
   * @param filename The absolute filename of the document file.
   * @param tags A set of tag strings (without the '#')
   * @param links A set of link strings (without the '^')
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly account: Account,
    readonly filename: string,
    readonly tags: ReadonlyArray<string> = [],
    readonly links: ReadonlyArray<string> = [],
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      account: String,
      filename: String,
      tags: [String],
      links: [String],
      meta: Object,
    };
  }

  get directiveType(): string {
    return "document";
  }

  get accounts(): ReadonlyArray<Account> {
    return [this.account];
  }

  toString() {
    let str =
      `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${this.account} ${writeString(this.filename)}`.trim();
    str +=
      " " +
      [...this.tags.map((it) => `#${it}`), ...this.links.map((it) => `^${it}`)]
        .join(" ")
        .trim();
    str += " " + stringifyMeta(this.meta);
    return str.trim();
  }
}

/**
 * A custom directive. This directive can be used to implement new experimental
 * dated features in the Beancount file. This is meant as an intermediate
 * measure to be used when you would need to implement a new directive in a
 * plugin. These directives will be parsed liberally... any list of tokens are
 * supported. All that is required is some unique name for them that acts as a
 * "type". These directives are included in the stream and a plugin should be
 * able to gather them.
 */
export class Custom extends DirectiveBase {
  /**
   * @param date A datetime.date instance; all directives have an associated
   *   date. Note: Beancount does not consider time, only dates. The line where
   *   the directive shows up in the file is used as a secondary sort key beyond
   *   the date.
   * @param type A string that represents the type of the directive.
   * @param values A list of values of various simple types supported by the
   *   grammar. (Note that this list is not enforced to be consistent for all
   *   directives of the same type by the parser.)
   * @param meta A dict of strings to objects, potentially attached to each of
   *   the directive types. The values may be strings, account names, tags,
   *   dates, numbers, amounts and currencies. There are two special attributes
   *   which are always present on all directives: 'filename' and 'lineno'.
   */
  constructor(
    readonly date: DateTime,
    readonly type: string,
    readonly values: ReadonlyArray<ScalarType> = [],
    readonly meta: Metadata = {},
  ) {
    super(meta);
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      type: String,
      values: [Object],
      meta: Object,
    };
  }

  copy(
    data: Partial<{
      date: DateTime;
      type: string;
      values: ScalarType[];
      meta: Metadata;
    }> = {},
  ) {
    return new Custom(
      data.date === undefined ? this.date : data.date,
      data.type === undefined ? this.type : data.type,
      data.values === undefined ? this.values : data.values,
      data.meta === undefined ? { ...this.meta } : data.meta,
    );
  }

  get directiveType(): string {
    return "custom";
  }

  get accounts(): ReadonlyArray<Account> {
    return [];
  }

  toString() {
    return `${formatDate(this.date)} ${this.directiveType.toLocaleLowerCase()} ${writeString(this.type)} ${writeScalar([...this.values])} ${stringifyMeta(this.meta)}`.trim();
  }
}

/** Type for any of the directives. */
export type Directive = DirectiveBase;

export type Directives = Array<Directive>;

/**
 * Return true if this position involves a conversion.
 *
 * A conversion is when there is a price attached to the amount but no cost.
 * This is used on transactions to convert between units.
 *
 * @param posting An instance of Posting
 * @returns A boolean, true if this posting has a price conversion.
 */
export function postingHasConversion(posting: Posting) {
  return posting.cost === null && posting.price !== null;
}

/**
 * Given a Transaction entry, return true if at least one of the postings has a
 * price conversion (without an associated cost). These are the source of
 * non-zero conversion balances.
 *
 * @param transaction An instance of a Transaction entry.
 * @returns A boolean, true if this transaction contains at least one posting
 *   with a price conversion.
 */
export function transactionHasConversion(transaction: Transaction) {
  return transaction.postings.some((it) => postingHasConversion(it));
}

/**
 * Return the entry associated with the posting or entry.
 *
 * @param entry A TxnPosting or entry instance
 * @returns
 */
export function getEntry(entry: TxnPosting | Transaction) {
  if (entry instanceof TxnPosting) {
    return entry.txn;
  }
  return entry;
}

/**
 * Sorting order of directives on the same day, by type:
 *
 * - Open entries should always be first.
 * - Balance entries should appear before Transactions, because they are defined
 *   to apply at the beginning of the day.
 * - All other directives come next (including Transactions).
 * - Document directives should appear after Transactions because they can be
 *   inserted on the statement date, which may include transactions on that
 *   date.
 * - Close directives should always appear last. This is the rationale for this
 *   sorting order.
 */
export const SORT_ORDER: Record<string, number> = {
  open: -2,
  balance: -1,
  document: 1,
  close: 2,
};

export function directiveSortKey(
  directive: Directive,
): [number, number, number] {
  return [
    directive.date?.toMillis() || -1,
    SORT_ORDER[directive.directiveType.toLowerCase()] || 0,
    directive.lineno,
  ];
}

export function sorted(directives: Array<Directive>) {
  return directives.sort((a, b) =>
    compare(directiveSortKey(a), directiveSortKey(b)),
  );
}

function compare(a: Array<number>, b: Array<number>) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) {
      continue;
    }
    return a[i] - b[i];
  }
  return 0;
}

export function filterTransactions(
  directives: Directives,
): ReadonlyArray<Transaction> {
  return directives.filter((it) => it instanceof Transaction);
}

export function filterPostings(
  directives: Directives,
): ReadonlyArray<TxnPosting> {
  return directives
    .filter((it) => it instanceof Transaction)
    .flatMap((txn) => txn.postings.map((p) => new TxnPosting(txn, p)));
}

export function isInstanceOf(
  directive: unknown,
  ...types: Array<typeof DirectiveBase>
) {
  return types.some((type) => directive instanceof type);
}

export function isDirective(obj: unknown): obj is Directive {
  return obj instanceof DirectiveBase;
}

export function optionKey(name: string | null | undefined) {
  if (!name) {
    return "";
  }
  return name.trim().replaceAll("-", "_").toLocaleLowerCase();
}
