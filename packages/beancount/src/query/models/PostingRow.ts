import { Amount } from "../../core/amount";
import { TxnPosting, resolveMissing } from "../../core/data";
import { Cost, Position } from "../../core/position";
import type { CounterInventory } from "../../core/inventory";
import type { Row, RecordContext } from "../db";
import { accountSortKey } from "../functions";

export class PostingRow implements Row {
  #source: TxnPosting;

  constructor(
    source: TxnPosting,
    readonly context: RecordContext,
  ) {
    this.#source = source;
  }

  copy(context: RecordContext) {
    return new PostingRow(this.#source, context);
  }

  get directive() {
    return this.#source;
  }

  get tx() {
    return this.#source.txn;
  }

  get account() {
    return this.#source.posting.account || "";
  }

  get account_sortkey() {
    return accountSortKey(this.account);
  }

  get currency() {
    return resolveMissing(this.#source.posting.units?.currency) || "";
  }

  get number() {
    return resolveMissing(this.#source.posting.units)?.numeric;
  }

  get cost() {
    const value = this.#source.posting.cost;
    if (value instanceof Cost) {
      return value.amount;
    }
    return null;
  }

  get cost_number() {
    return this.cost?.numeric;
  }

  get cost_currency() {
    return this.#source.posting.cost?.currency;
  }

  get cost_date() {
    const value = this.#source.posting.cost;
    if (value instanceof Cost) {
      return resolveMissing(value.date);
    }
    return null;
  }

  get cost_label() {
    const value = this.#source.posting.cost;
    if (value instanceof Cost) {
      return resolveMissing(value.label);
    }
    return null;
  }

  get price() {
    return resolveMissing(this.#source.posting.price);
  }

  get position() {
    const amount =
      resolveMissing(this.#source.posting.units) || new Amount("0");
    const cost = resolveMissing(this.#source.posting.cost);
    if (cost instanceof Cost) {
      return new Position(amount, cost);
    }
    return new Position(amount);
  }

  #balance!: CounterInventory;
  get balance() {
    if (!this.#balance) {
      const pos = this.position;
      if (pos) {
        this.context.balance.add(pos.units, pos.cost);
      }
      this.#balance = this.context.balance.copy();
    }
    return this.#balance;
  }

  get type() {
    return this.#source.txn.directiveType;
  }

  get id() {
    return this.#source.id;
  }

  get transaction_id() {
    return this.#source.txn.id;
  }

  get date() {
    return this.#source.txn.date;
  }

  get year() {
    return this.#source.txn.date.getFullYear();
  }

  get month() {
    return this.#source.txn.date.getMonth() + 1;
  }

  get day() {
    return this.#source.txn.date.getDate();
  }

  get flag() {
    return this.#source.txn.flag;
  }

  get posting_flag() {
    return this.#source.posting.flag;
  }

  get payee() {
    return this.#source.txn.payee;
  }

  get narration() {
    return this.#source.txn.narration;
  }

  get lineno() {
    return (
      this.#source.posting.meta["lineno"] ?? this.#source.txn.meta["lineno"]
    );
  }

  get filename() {
    return (
      this.#source.posting.meta["filename"] ?? this.#source.txn.meta["filename"]
    );
  }

  get tags() {
    return this.#source.txn.tags;
  }

  get links() {
    return this.#source.txn.links;
  }

  get other_accounts() {
    return this.#source.txn
      .accounts()
      .filter((it) => it !== this.#source.posting.account);
  }
}
