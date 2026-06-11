import type { Transaction } from "../../core/data";
import type { Row, RecordContext } from "../db";

export class TransactionRow implements Row {
  #source: Transaction;

  constructor(
    source: Transaction,
    readonly context: RecordContext,
  ) {
    this.#source = source;
  }

  copy(context: RecordContext) {
    return new TransactionRow(this.#source, context);
  }

  get directive() {
    return this.#source;
  }

  get accounts() {
    return this.#source.accounts();
  }

  get type() {
    return this.#source.directiveType;
  }

  get id() {
    return this.#source.id;
  }

  get date() {
    return this.#source.date;
  }

  get year() {
    return this.#source.date.getFullYear();
  }

  get month() {
    return this.#source.date.getMonth() + 1;
  }

  get day() {
    return this.#source.date.getDate();
  }

  get flag() {
    return this.#source.flag;
  }

  get payee() {
    return this.#source.payee;
  }

  get narration() {
    return `${this.#source.payee || ""} ${this.#source.narration || ""}`.trim();
  }

  get lineno() {
    return this.#source.meta["lineno"];
  }

  get filename() {
    return this.#source.meta["filename"];
  }

  get tags() {
    return this.#source.tags;
  }

  get links() {
    return this.#source.links;
  }
}
