import {
  type Directive,
  Transaction,
  TxnPosting,
  Note,
  Event,
} from "../../core/data";
import type { Row, RecordContext } from "../db";
import { PostingRow } from "./PostingRow";

export class DirectiveRow implements Row {
  #source: Directive;
  tx: Transaction | null = null;
  postings: PostingRow[] = [];

  constructor(
    source: Directive,
    readonly context: RecordContext,
  ) {
    this.#source = source;
    if (source instanceof Transaction) {
      this.tx = source;
      this.postings = source.postings.map(
        (it) => new PostingRow(new TxnPosting(source, it), context),
      );
    }
  }

  copy(context: RecordContext) {
    return new DirectiveRow(this.#source, context);
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
    return this.#source.date?.getFullYear();
  }

  get month() {
    if (!this.#source.date) {
      return null;
    }
    return this.#source.date?.getMonth() + 1;
  }

  get day() {
    return this.#source.date?.getDate();
  }

  get flag() {
    if (this.#source instanceof Transaction) {
      return this.#source.flag;
    }
  }

  get payee() {
    return this.tx?.payee;
  }

  get narration() {
    if (this.tx) {
      return `${this.tx?.payee || ""} ${this.tx?.narration || ""}`.trim();
    } else if (this.#source instanceof Note) {
      return this.#source.comment;
    } else if (this.#source instanceof Event) {
      return this.#source.description;
    }
    return null;
  }

  get lineno() {
    return this.#source.meta["lineno"];
  }

  get filename() {
    return this.#source.meta["filename"];
  }

  get tags() {
    return this.tx?.tags || [];
  }

  get links() {
    return this.tx?.links || [];
  }
}
